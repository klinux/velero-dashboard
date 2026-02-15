package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type localUser struct {
	Username     string
	PasswordHash string
	Role         string
}

// BasicProvider handles username/password authentication via env-configured users.
type BasicProvider struct {
	users  map[string]localUser
	jwtMgr *JWTManager
	logger *zap.Logger
}

// NewBasicProvider creates a basic auth provider. usersEnv format: "user1:bcrypt_hash:role,user2:bcrypt_hash:role"
func NewBasicProvider(usersEnv string, jwtMgr *JWTManager, logger *zap.Logger) (*BasicProvider, error) {
	users := ParseUsers(usersEnv)
	if len(users) == 0 {
		logger.Warn("AUTH_MODE=basic but no valid users configured in AUTH_USERS")
	}
	return &BasicProvider{users: users, jwtMgr: jwtMgr, logger: logger}, nil
}

func (p *BasicProvider) Mode() string {
	return "basic"
}

func (p *BasicProvider) SetupRoutes(router fiber.Router) {
	router.Post("/auth/login", p.login)
	router.Get("/auth/me", RequireAuth(p.jwtMgr, p.logger), p.me)
}

func (p *BasicProvider) Middleware() fiber.Handler {
	return RequireAuth(p.jwtMgr, p.logger)
}

func (p *BasicProvider) login(c *fiber.Ctx) error {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Username == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "username and password are required"})
	}

	user, ok := p.users[req.Username]
	if !ok {
		p.logger.Debug("Login attempt for unknown user", zap.String("username", req.Username))
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		p.logger.Debug("Failed password check", zap.String("username", req.Username))
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}

	token, err := p.jwtMgr.Generate(UserInfo{Username: user.Username, Role: user.Role})
	if err != nil {
		p.logger.Error("Failed to generate JWT", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate token"})
	}

	return c.JSON(fiber.Map{
		"token":    token,
		"username": user.Username,
		"role":     user.Role,
	})
}

func (p *BasicProvider) me(c *fiber.Ctx) error {
	user := GetUser(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "not authenticated"})
	}
	return c.JSON(user)
}

// ParseUsers parses "user1:bcrypt_hash:role,user2:bcrypt_hash:role" into a map.
func ParseUsers(env string) map[string]localUser {
	users := make(map[string]localUser)
	if env == "" {
		return users
	}
	for _, entry := range strings.Split(env, ",") {
		parts := strings.SplitN(strings.TrimSpace(entry), ":", 3)
		if len(parts) != 3 {
			continue
		}
		username, hash, role := parts[0], parts[1], parts[2]
		if role != RoleViewer && role != RoleOperator && role != RoleAdmin {
			role = RoleViewer
		}
		users[username] = localUser{
			Username:     username,
			PasswordHash: hash,
			Role:         role,
		}
	}
	return users
}
