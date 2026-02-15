package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server     ServerConfig
	Velero     VeleroConfig
	Kubeconfig string
	Auth       AuthConfig
}

type ServerConfig struct {
	Host           string
	Port           string
	AllowedOrigins string
}

func (s ServerConfig) Address() string {
	return fmt.Sprintf("%s:%s", s.Host, s.Port)
}

type VeleroConfig struct {
	Namespace string
}

type AuthConfig struct {
	Mode              string
	JWTSecret         string
	JWTExpiration     time.Duration
	Users             string // basic mode: "user:hash:role,..."
	OIDCIssuer        string
	OIDCClientID      string
	OIDCClientSecret  string
	OIDCRedirectURL   string
	OIDCRoleClaim     string
	OIDCAdminGroups   string
	OIDCOperatorGroups string
	OIDCDefaultRole   string
	FrontendURL       string
}

func LoadConfig() (*Config, error) {
	viper.SetDefault("SERVER_HOST", "0.0.0.0")
	viper.SetDefault("SERVER_PORT", "8080")
	viper.SetDefault("SERVER_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
	viper.SetDefault("VELERO_NAMESPACE", "velero")
	viper.SetDefault("KUBECONFIG", "")

	// Auth defaults
	viper.SetDefault("AUTH_MODE", "none")
	viper.SetDefault("JWT_SECRET", "")
	viper.SetDefault("JWT_EXPIRATION", "24h")
	viper.SetDefault("AUTH_USERS", "")
	viper.SetDefault("OIDC_ISSUER", "")
	viper.SetDefault("OIDC_CLIENT_ID", "")
	viper.SetDefault("OIDC_CLIENT_SECRET", "")
	viper.SetDefault("OIDC_REDIRECT_URL", "")
	viper.SetDefault("OIDC_ROLE_CLAIM", "groups")
	viper.SetDefault("OIDC_ADMIN_GROUPS", "velero-admins")
	viper.SetDefault("OIDC_OPERATOR_GROUPS", "velero-operators")
	viper.SetDefault("OIDC_DEFAULT_ROLE", "viewer")
	viper.SetDefault("FRONTEND_URL", "http://localhost:3001")

	viper.AutomaticEnv()
	_ = viper.ReadInConfig()

	expiration, err := time.ParseDuration(viper.GetString("JWT_EXPIRATION"))
	if err != nil {
		expiration = 24 * time.Hour
	}

	return &Config{
		Server: ServerConfig{
			Host:           viper.GetString("SERVER_HOST"),
			Port:           viper.GetString("SERVER_PORT"),
			AllowedOrigins: viper.GetString("SERVER_ALLOWED_ORIGINS"),
		},
		Velero: VeleroConfig{
			Namespace: viper.GetString("VELERO_NAMESPACE"),
		},
		Kubeconfig: viper.GetString("KUBECONFIG"),
		Auth: AuthConfig{
			Mode:              viper.GetString("AUTH_MODE"),
			JWTSecret:         viper.GetString("JWT_SECRET"),
			JWTExpiration:     expiration,
			Users:             viper.GetString("AUTH_USERS"),
			OIDCIssuer:        viper.GetString("OIDC_ISSUER"),
			OIDCClientID:      viper.GetString("OIDC_CLIENT_ID"),
			OIDCClientSecret:  viper.GetString("OIDC_CLIENT_SECRET"),
			OIDCRedirectURL:   viper.GetString("OIDC_REDIRECT_URL"),
			OIDCRoleClaim:     viper.GetString("OIDC_ROLE_CLAIM"),
			OIDCAdminGroups:   viper.GetString("OIDC_ADMIN_GROUPS"),
			OIDCOperatorGroups: viper.GetString("OIDC_OPERATOR_GROUPS"),
			OIDCDefaultRole:   viper.GetString("OIDC_DEFAULT_ROLE"),
			FrontendURL:       viper.GetString("FRONTEND_URL"),
		},
	}, nil
}
