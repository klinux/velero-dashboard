package auth

import "github.com/gofiber/fiber/v2"

const (
	RoleViewer   = "viewer"
	RoleOperator = "operator"
	RoleAdmin    = "admin"
)

// UserInfo represents an authenticated user.
type UserInfo struct {
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
	Role     string `json:"role"`
}

// AuthProvider is the interface for all auth backends.
type AuthProvider interface {
	Mode() string
	SetupRoutes(router fiber.Router)
	Middleware() fiber.Handler
}

// RoleHierarchy returns true if userRole >= requiredRole.
func RoleHierarchy(userRole, requiredRole string) bool {
	levels := map[string]int{
		RoleViewer:   1,
		RoleOperator: 2,
		RoleAdmin:    3,
	}
	return levels[userRole] >= levels[requiredRole]
}
