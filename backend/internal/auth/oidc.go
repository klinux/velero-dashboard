package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
	"golang.org/x/oauth2"
)

// OIDCConfig holds OIDC provider configuration.
type OIDCConfig struct {
	Issuer         string
	ClientID       string
	ClientSecret   string
	RedirectURL    string
	RoleClaim      string
	AdminGroups    []string
	OperatorGroups []string
	DefaultRole    string
	FrontendURL    string
}

// OIDCProvider handles OIDC authentication.
type OIDCProvider struct {
	provider     *oidc.Provider
	oauth2Config oauth2.Config
	verifier     *oidc.IDTokenVerifier
	cfg          OIDCConfig
	jwtMgr       *JWTManager
	logger       *zap.Logger
}

// NewOIDCProvider creates a new OIDC auth provider.
func NewOIDCProvider(cfg OIDCConfig, jwtMgr *JWTManager, logger *zap.Logger) (*OIDCProvider, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	provider, err := oidc.NewProvider(ctx, cfg.Issuer)
	if err != nil {
		return nil, err
	}

	scopes := []string{oidc.ScopeOpenID, "profile", "email"}
	if cfg.RoleClaim == "groups" {
		scopes = append(scopes, "groups")
	}

	oauth2Config := oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       scopes,
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: cfg.ClientID})

	return &OIDCProvider{
		provider:     provider,
		oauth2Config: oauth2Config,
		verifier:     verifier,
		cfg:          cfg,
		jwtMgr:       jwtMgr,
		logger:       logger,
	}, nil
}

func (p *OIDCProvider) Mode() string {
	return "oidc"
}

func (p *OIDCProvider) SetupRoutes(router fiber.Router) {
	router.Get("/auth/oidc/login", p.login)
	router.Get("/auth/oidc/callback", p.callback)
	router.Get("/auth/me", RequireAuth(p.jwtMgr, p.logger), p.me)
}

func (p *OIDCProvider) Middleware() fiber.Handler {
	return RequireAuth(p.jwtMgr, p.logger)
}

func (p *OIDCProvider) login(c *fiber.Ctx) error {
	state := generateState()

	c.Cookie(&fiber.Cookie{
		Name:     "oidc_state",
		Value:    state,
		MaxAge:   300, // 5 minutes
		HTTPOnly: true,
		SameSite: "Lax",
	})

	authURL := p.oauth2Config.AuthCodeURL(state)
	return c.Redirect(authURL, fiber.StatusTemporaryRedirect)
}

func (p *OIDCProvider) callback(c *fiber.Ctx) error {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing code parameter"})
	}

	expectedState := c.Cookies("oidc_state")
	if expectedState != "" && state != expectedState {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid state parameter"})
	}

	// Clear state cookie
	c.Cookie(&fiber.Cookie{
		Name:     "oidc_state",
		Value:    "",
		MaxAge:   -1,
		HTTPOnly: true,
	})

	ctx := context.Background()
	oauth2Token, err := p.oauth2Config.Exchange(ctx, code)
	if err != nil {
		p.logger.Error("OIDC token exchange failed", zap.Error(err))
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "token exchange failed"})
	}

	rawIDToken, ok := oauth2Token.Extra("id_token").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "no id_token in response"})
	}

	idToken, err := p.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		p.logger.Error("OIDC token verification failed", zap.Error(err))
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "token verification failed"})
	}

	var claims map[string]interface{}
	if err := idToken.Claims(&claims); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to parse claims"})
	}

	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)
	if name == "" {
		name = email
	}

	role := p.resolveRole(claims)

	token, err := p.jwtMgr.Generate(UserInfo{Username: name, Email: email, Role: role})
	if err != nil {
		p.logger.Error("Failed to generate JWT", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate token"})
	}

	// Redirect to frontend callback with token
	frontendCallback := p.cfg.FrontendURL + "/auth/callback?token=" + url.QueryEscape(token)
	return c.Redirect(frontendCallback, fiber.StatusTemporaryRedirect)
}

func (p *OIDCProvider) me(c *fiber.Ctx) error {
	user := GetUser(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "not authenticated"})
	}
	return c.JSON(user)
}

func (p *OIDCProvider) resolveRole(claims map[string]interface{}) string {
	groups := extractGroups(claims, p.cfg.RoleClaim)

	for _, g := range groups {
		for _, admin := range p.cfg.AdminGroups {
			if strings.EqualFold(g, admin) {
				return RoleAdmin
			}
		}
	}
	for _, g := range groups {
		for _, op := range p.cfg.OperatorGroups {
			if strings.EqualFold(g, op) {
				return RoleOperator
			}
		}
	}
	return p.cfg.DefaultRole
}

func extractGroups(claims map[string]interface{}, claimKey string) []string {
	val, ok := claims[claimKey]
	if !ok {
		return nil
	}
	switch v := val.(type) {
	case []interface{}:
		groups := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				groups = append(groups, s)
			}
		}
		return groups
	case string:
		return strings.Split(v, ",")
	}
	return nil
}

func generateState() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("failed to generate random state: " + err.Error())
	}
	return hex.EncodeToString(b)
}
