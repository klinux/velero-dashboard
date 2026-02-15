package auth

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the JWT payload.
type Claims struct {
	jwt.RegisteredClaims
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
	Role     string `json:"role"`
}

// JWTManager handles JWT token generation and validation.
type JWTManager struct {
	secret     []byte
	expiration time.Duration
}

// NewJWTManager creates a new JWT manager. If secret is empty, generates a random one.
func NewJWTManager(secret string, expiration time.Duration) *JWTManager {
	if secret == "" {
		b := make([]byte, 32)
		rand.Read(b)
		secret = hex.EncodeToString(b)
	}
	return &JWTManager{
		secret:     []byte(secret),
		expiration: expiration,
	}
}

// Generate creates a signed JWT for the given user.
func (m *JWTManager) Generate(user UserInfo) (string, error) {
	now := time.Now()
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(m.expiration)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   user.Username,
		},
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// Validate parses and validates a JWT token string, returning the claims.
func (m *JWTManager) Validate(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}
