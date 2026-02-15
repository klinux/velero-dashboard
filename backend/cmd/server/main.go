package main

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/klinux/velero-dashboard/internal/auth"
	"github.com/klinux/velero-dashboard/internal/config"
	"github.com/klinux/velero-dashboard/internal/handler"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"github.com/klinux/velero-dashboard/internal/middleware"
	"github.com/klinux/velero-dashboard/internal/ws"
	"go.uber.org/zap"
)

func main() {
	zapLogger, _ := zap.NewProduction()
	defer zapLogger.Sync()

	cfg, err := config.LoadConfig()
	if err != nil {
		zapLogger.Fatal("Failed to load config", zap.Error(err))
	}

	k8sClient, err := k8s.NewClient(cfg.Kubeconfig, cfg.Velero.Namespace, zapLogger)
	if err != nil {
		zapLogger.Fatal("Failed to create K8s client", zap.Error(err))
	}

	hub := ws.NewHub(zapLogger)
	handlers := handler.NewHandlers(k8sClient, hub, zapLogger)

	// Start informers for real-time updates
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	informerMgr := k8s.NewInformerManager(k8sClient, hub, zapLogger)
	go informerMgr.Start(ctx)

	// Initialize auth provider
	jwtMgr := auth.NewJWTManager(cfg.Auth.JWTSecret, cfg.Auth.JWTExpiration)
	authProvider, err := initAuthProvider(cfg.Auth, jwtMgr, zapLogger)
	if err != nil {
		zapLogger.Fatal("Failed to initialize auth provider", zap.Error(err))
	}
	zapLogger.Info("Auth mode configured", zap.String("mode", authProvider.Mode()))

	app := fiber.New(fiber.Config{
		AppName:      "Velero Dashboard API",
		ServerHeader: "velero-dashboard",
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(middleware.NewCORS(cfg.Server.AllowedOrigins))

	// ── Public routes (no auth) ─────────────────────────────────

	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Auth config endpoint — frontend needs to know which mode to render
	app.Get("/api/auth/config", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"mode": authProvider.Mode()})
	})

	// Provider-specific public routes (login, callback, etc.)
	authProvider.SetupRoutes(app.Group("/api"))

	// ── Protected routes ────────────────────────────────────────

	api := app.Group("/api", authProvider.Middleware())

	// Viewer-level routes (any authenticated user)
	api.Get("/dashboard/stats", handlers.Dashboard.Stats)

	api.Get("/backups", handlers.Backup.List)
	api.Get("/backups/compare", handlers.Backup.Compare)
	api.Get("/backups/:name", handlers.Backup.Get)
	api.Get("/backups/:name/logs", handlers.Backup.Logs)

	api.Get("/restores", handlers.Restore.List)
	api.Get("/restores/:name", handlers.Restore.Get)

	api.Get("/schedules", handlers.Schedule.List)
	api.Get("/schedules/:name", handlers.Schedule.Get)

	api.Get("/settings/backup-locations", handlers.Settings.BackupLocations)
	api.Get("/settings/snapshot-locations", handlers.Settings.SnapshotLocations)
	api.Get("/settings/server-info", handlers.Settings.ServerInfo)

	// Operator-level routes (operator + admin)
	operator := api.Group("", auth.RequireRole(auth.RoleOperator))
	operator.Post("/backups", handlers.Backup.Create)
	operator.Delete("/backups/:name", handlers.Backup.Delete)
	operator.Post("/restores", handlers.Restore.Create)
	operator.Post("/schedules", handlers.Schedule.Create)
	operator.Patch("/schedules/:name", handlers.Schedule.TogglePause)
	operator.Delete("/schedules/:name", handlers.Schedule.Delete)

	// Admin-level routes (admin only)
	admin := api.Group("", auth.RequireRole(auth.RoleAdmin))
	admin.Post("/settings/backup-locations", handlers.Settings.CreateBackupLocation)
	admin.Patch("/settings/backup-locations/:name", handlers.Settings.UpdateBackupLocation)
	admin.Delete("/settings/backup-locations/:name", handlers.Settings.DeleteBackupLocation)
	admin.Post("/settings/snapshot-locations", handlers.Settings.CreateSnapshotLocation)
	admin.Patch("/settings/snapshot-locations/:name", handlers.Settings.UpdateSnapshotLocation)
	admin.Delete("/settings/snapshot-locations/:name", handlers.Settings.DeleteSnapshotLocation)

	// ── WebSocket ───────────────────────────────────────────────

	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws", websocket.New(handlers.WS.Handle))

	// ── Graceful shutdown ───────────────────────────────────────

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		zapLogger.Info("Shutting down...")
		cancel()
		app.Shutdown()
	}()

	zapLogger.Info("Starting Velero Dashboard API",
		zap.String("address", cfg.Server.Address()),
		zap.String("auth_mode", authProvider.Mode()),
	)
	if err := app.Listen(cfg.Server.Address()); err != nil {
		zapLogger.Fatal("Server failed", zap.Error(err))
	}
}

func initAuthProvider(cfg config.AuthConfig, jwtMgr *auth.JWTManager, logger *zap.Logger) (auth.AuthProvider, error) {
	switch cfg.Mode {
	case "basic":
		if cfg.JWTSecret == "" {
			logger.Warn("JWT_SECRET not set for basic auth — using auto-generated secret (sessions won't survive restarts)")
		}
		return auth.NewBasicProvider(cfg.Users, jwtMgr, logger)

	case "oidc":
		if cfg.JWTSecret == "" {
			logger.Warn("JWT_SECRET not set for OIDC auth — using auto-generated secret (sessions won't survive restarts)")
		}
		return auth.NewOIDCProvider(auth.OIDCConfig{
			Issuer:         cfg.OIDCIssuer,
			ClientID:       cfg.OIDCClientID,
			ClientSecret:   cfg.OIDCClientSecret,
			RedirectURL:    cfg.OIDCRedirectURL,
			RoleClaim:      cfg.OIDCRoleClaim,
			AdminGroups:    splitTrim(cfg.OIDCAdminGroups),
			OperatorGroups: splitTrim(cfg.OIDCOperatorGroups),
			DefaultRole:    cfg.OIDCDefaultRole,
			FrontendURL:    cfg.FrontendURL,
		}, jwtMgr, logger)

	default:
		return auth.NewNoneProvider(), nil
	}
}

func splitTrim(s string) []string {
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
