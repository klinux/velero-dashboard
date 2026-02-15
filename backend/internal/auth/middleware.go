package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

const UserContextKey = "auth_user"

// RequireAuth creates middleware that validates a JWT from the Authorization header.
func RequireAuth(jwtMgr *JWTManager, logger *zap.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing authorization header",
			})
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == authHeader {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid authorization format, expected Bearer token",
			})
		}

		claims, err := jwtMgr.Validate(tokenStr)
		if err != nil {
			logger.Debug("JWT validation failed", zap.Error(err))
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or expired token",
			})
		}

		c.Locals(UserContextKey, &UserInfo{
			Username: claims.Username,
			Email:    claims.Email,
			Role:     claims.Role,
		})
		return c.Next()
	}
}

// RequireRole checks that the authenticated user has at least the required role.
func RequireRole(requiredRole string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := GetUser(c)
		if user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "not authenticated",
			})
		}
		if !RoleHierarchy(user.Role, requiredRole) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":    "insufficient permissions",
				"required": requiredRole,
				"current":  user.Role,
			})
		}
		return c.Next()
	}
}

// GetUser extracts the authenticated user from the Fiber context.
func GetUser(c *fiber.Ctx) *UserInfo {
	user, _ := c.Locals(UserContextKey).(*UserInfo)
	return user
}
