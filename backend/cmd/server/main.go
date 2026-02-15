package main

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/adaptor/v2"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/klinux/velero-dashboard/internal/auth"
	"github.com/klinux/velero-dashboard/internal/cluster"
	"github.com/klinux/velero-dashboard/internal/config"
	"github.com/klinux/velero-dashboard/internal/handler"
	"github.com/klinux/velero-dashboard/internal/middleware"
	"github.com/klinux/velero-dashboard/internal/notification"
	"github.com/klinux/velero-dashboard/internal/ws"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

func main() {
	zapLogger, _ := zap.NewProduction()
	defer func() { _ = zapLogger.Sync() }()

	cfg, err := config.LoadConfig()
	if err != nil {
		zapLogger.Fatal("Failed to load config", zap.Error(err))
	}

	// Initialize cluster store (SQLite or Kubernetes ConfigMap+Secrets)
	storeConfig := cluster.StoreConfig{
		StorageType:   cfg.Cluster.StorageType,
		DBPath:        cfg.Cluster.DBPath,
		EncryptionKey: cfg.Cluster.EncryptionKey,
		Namespace:     cfg.Cluster.Namespace,
		ConfigMapName: cfg.Cluster.ConfigMapName,
	}
	clusterStore, err := cluster.NewStore(storeConfig, zapLogger)
	if err != nil {
		zapLogger.Fatal("Failed to create cluster store", zap.Error(err))
	}

	// Initialize notification store (reuses same storage type)
	notifStore, err := notification.NewStore(notification.StoreConfig{
		StorageType: cfg.Cluster.StorageType,
		DBPath:      cfg.Cluster.DBPath,
		Namespace:   cfg.Cluster.Namespace,
	}, zapLogger)
	if err != nil {
		zapLogger.Fatal("Failed to create notification store", zap.Error(err))
	}
	notifMgr := notification.NewManager(notifStore, zapLogger)

	hub := ws.NewHub(zapLogger)

	// Initialize cluster manager
	clusterMgr := cluster.NewManager(clusterStore, hub, zapLogger)
	clusterMgr.SetNotifier(notification.NewAdapter(notifMgr))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start cluster manager (connects to all clusters and starts informers)
	if err := clusterMgr.Start(ctx); err != nil {
		zapLogger.Fatal("Failed to start cluster manager", zap.Error(err))
	}

	// MIGRATION: If no clusters exist and legacy config present, auto-migrate
	clusters, _ := clusterStore.List(ctx)
	if len(clusters) == 0 && cfg.Kubeconfig != "" {
		zapLogger.Info("Migrating legacy single-cluster configuration", zap.String("kubeconfig", cfg.Kubeconfig))

		// Read kubeconfig file contents (not just the path)
		kubeconfigData, err := os.ReadFile(cfg.Kubeconfig)
		if err != nil {
			zapLogger.Error("Failed to read kubeconfig file for migration", zap.Error(err))
		} else {
			req := cluster.CreateClusterRequest{
				Name:         "default",
				Kubeconfig:   string(kubeconfigData), // Pass contents, not path
				Namespace:    cfg.Velero.Namespace,
				SetAsDefault: true,
			}
			newCluster, err := clusterStore.Create(ctx, req)
			if err == nil {
				_ = clusterMgr.AddCluster(ctx, newCluster)
				zapLogger.Info("Legacy configuration migrated successfully")
			} else {
				zapLogger.Error("Failed to migrate legacy configuration", zap.Error(err))
			}
		}
	}

	// Start reconciliation loop (watches for externally created/deleted cluster Secrets)
	go func() {
		if err := clusterMgr.StartReconciliation(ctx); err != nil {
			zapLogger.Warn("Cluster reconciliation failed", zap.Error(err))
		}
	}()

	handlers := handler.NewHandlers(clusterMgr, hub, notifMgr, zapLogger)

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
	app.Use(middleware.NewMetrics())

	// Rate limiter: 100 requests per minute per IP
	app.Use(limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Rate limit exceeded. Try again later.",
			})
		},
		SkipFailedRequests: true,
	}))

	// ── Public routes (no auth) ─────────────────────────────────

	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Prometheus metrics endpoint (no auth)
	app.Get("/metrics", adaptor.HTTPHandler(promhttp.Handler()))

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
	api.Get("/backups/shared", handlers.CrossCluster.SharedBackups)
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
	operator.Post("/restores/cross-cluster", handlers.CrossCluster.CreateCrossClusterRestore)
	operator.Post("/schedules", handlers.Schedule.Create)
	operator.Patch("/schedules/:name", handlers.Schedule.TogglePause)
	operator.Delete("/schedules/:name", handlers.Schedule.Delete)

	// Admin-level routes (admin only)
	admin := api.Group("", auth.RequireRole(auth.RoleAdmin))

	// Cluster management (admin only)
	admin.Get("/clusters", handlers.Cluster.List)
	admin.Get("/clusters/:id", handlers.Cluster.Get)
	admin.Post("/clusters", handlers.Cluster.Create)
	admin.Patch("/clusters/:id", handlers.Cluster.Update)
	admin.Delete("/clusters/:id", handlers.Cluster.Delete)

	// Webhook notifications (admin only)
	admin.Get("/notifications/webhooks", handlers.Notification.ListWebhooks)
	admin.Post("/notifications/webhooks", handlers.Notification.CreateWebhook)
	admin.Patch("/notifications/webhooks/:id", handlers.Notification.UpdateWebhook)
	admin.Delete("/notifications/webhooks/:id", handlers.Notification.DeleteWebhook)
	admin.Post("/notifications/webhooks/:id/test", handlers.Notification.TestWebhook)

	// Storage locations
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
		clusterMgr.Shutdown() // Stop all cluster connections and informers
		_ = notifStore.Close()
		if err := app.Shutdown(); err != nil {
			zapLogger.Error("Shutdown error", zap.Error(err))
		}
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
