package auth

import (
	"testing"
	"time"
)

func TestRoleHierarchy(t *testing.T) {
	tests := []struct {
		userRole     string
		requiredRole string
		expected     bool
	}{
		{RoleAdmin, RoleAdmin, true},
		{RoleAdmin, RoleOperator, true},
		{RoleAdmin, RoleViewer, true},
		{RoleOperator, RoleAdmin, false},
		{RoleOperator, RoleOperator, true},
		{RoleOperator, RoleViewer, true},
		{RoleViewer, RoleAdmin, false},
		{RoleViewer, RoleOperator, false},
		{RoleViewer, RoleViewer, true},
		{"unknown", RoleViewer, false},
		{RoleViewer, "unknown", true}, // unknown role has level 0
	}

	for _, tt := range tests {
		result := RoleHierarchy(tt.userRole, tt.requiredRole)
		if result != tt.expected {
			t.Errorf("RoleHierarchy(%q, %q) = %v, want %v", tt.userRole, tt.requiredRole, result, tt.expected)
		}
	}
}

func TestJWTGenerateAndValidate(t *testing.T) {
	jwtMgr := NewJWTManager("test-secret-key", 1*time.Hour)

	user := UserInfo{
		Username: "admin",
		Email:    "admin@example.com",
		Role:     RoleAdmin,
	}

	token, err := jwtMgr.Generate(user)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	if token == "" {
		t.Fatal("Generate returned empty token")
	}

	claims, err := jwtMgr.Validate(token)
	if err != nil {
		t.Fatalf("Validate failed: %v", err)
	}

	if claims.Username != "admin" {
		t.Errorf("Username = %q, want %q", claims.Username, "admin")
	}
	if claims.Email != "admin@example.com" {
		t.Errorf("Email = %q, want %q", claims.Email, "admin@example.com")
	}
	if claims.Role != RoleAdmin {
		t.Errorf("Role = %q, want %q", claims.Role, RoleAdmin)
	}
	if claims.Subject != "admin" {
		t.Errorf("Subject = %q, want %q", claims.Subject, "admin")
	}
}

func TestJWTExpired(t *testing.T) {
	// Token that expires immediately
	jwtMgr := NewJWTManager("test-secret-key", -1*time.Second)

	user := UserInfo{Username: "admin", Role: RoleAdmin}
	token, err := jwtMgr.Generate(user)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	_, err = jwtMgr.Validate(token)
	if err == nil {
		t.Fatal("Expected validation error for expired token, got nil")
	}
}

func TestJWTInvalidSecret(t *testing.T) {
	jwtMgr1 := NewJWTManager("secret-1", 1*time.Hour)
	jwtMgr2 := NewJWTManager("secret-2", 1*time.Hour)

	user := UserInfo{Username: "admin", Role: RoleAdmin}
	token, _ := jwtMgr1.Generate(user)

	_, err := jwtMgr2.Validate(token)
	if err == nil {
		t.Fatal("Expected validation error for wrong secret, got nil")
	}
}

func TestJWTAutoGenerateSecret(t *testing.T) {
	jwtMgr := NewJWTManager("", 1*time.Hour)

	user := UserInfo{Username: "test", Role: RoleViewer}
	token, err := jwtMgr.Generate(user)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	claims, err := jwtMgr.Validate(token)
	if err != nil {
		t.Fatalf("Validate failed: %v", err)
	}
	if claims.Username != "test" {
		t.Errorf("Username = %q, want %q", claims.Username, "test")
	}
}

func TestParseUsers(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int
	}{
		{"empty string", "", 0},
		{"single user", "admin:$2a$10$hash:admin", 1},
		{"two users", "admin:$2a$10$hash:admin,viewer:$2a$10$hash2:viewer", 2},
		{"invalid entry (only 2 parts)", "admin:hash", 0},
		{"mixed valid and invalid", "admin:$2a$10$hash:admin,invalid", 1},
		{"whitespace handling", " admin:$2a$10$hash:admin , viewer:$2a$10$hash2:viewer ", 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			users := ParseUsers(tt.input)
			if len(users) != tt.expected {
				t.Errorf("ParseUsers(%q) returned %d users, want %d", tt.input, len(users), tt.expected)
			}
		})
	}
}

func TestParseUsersRoleValidation(t *testing.T) {
	users := ParseUsers("admin:hash:admin,op:hash:operator,view:hash:viewer,bad:hash:superadmin")

	if users["admin"].Role != RoleAdmin {
		t.Errorf("admin role = %q, want %q", users["admin"].Role, RoleAdmin)
	}
	if users["op"].Role != RoleOperator {
		t.Errorf("op role = %q, want %q", users["op"].Role, RoleOperator)
	}
	if users["view"].Role != RoleViewer {
		t.Errorf("view role = %q, want %q", users["view"].Role, RoleViewer)
	}
	// Invalid role should default to viewer
	if users["bad"].Role != RoleViewer {
		t.Errorf("bad role = %q, want %q (default)", users["bad"].Role, RoleViewer)
	}
}

func TestExtractGroups(t *testing.T) {
	tests := []struct {
		name     string
		claims   map[string]interface{}
		key      string
		expected []string
	}{
		{
			"string array",
			map[string]interface{}{"groups": []interface{}{"admin", "users"}},
			"groups",
			[]string{"admin", "users"},
		},
		{
			"comma-separated string",
			map[string]interface{}{"roles": "admin,operator"},
			"roles",
			[]string{"admin", "operator"},
		},
		{
			"missing key",
			map[string]interface{}{"other": "value"},
			"groups",
			nil,
		},
		{
			"empty array",
			map[string]interface{}{"groups": []interface{}{}},
			"groups",
			[]string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractGroups(tt.claims, tt.key)
			if tt.expected == nil {
				if result != nil {
					t.Errorf("expected nil, got %v", result)
				}
				return
			}
			if len(result) != len(tt.expected) {
				t.Errorf("got %d groups, want %d", len(result), len(tt.expected))
				return
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("group[%d] = %q, want %q", i, result[i], tt.expected[i])
				}
			}
		})
	}
}
