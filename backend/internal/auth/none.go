package auth

import "github.com/gofiber/fiber/v2"

// NoneProvider is the no-auth provider. All requests get admin role.
type NoneProvider struct{}

func NewNoneProvider() *NoneProvider {
	return &NoneProvider{}
}

func (p *NoneProvider) Mode() string {
	return "none"
}

func (p *NoneProvider) SetupRoutes(router fiber.Router) {
	// No routes needed when auth is disabled.
}

func (p *NoneProvider) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Locals(UserContextKey, &UserInfo{
			Username: "anonymous",
			Role:     RoleAdmin,
		})
		return c.Next()
	}
}
