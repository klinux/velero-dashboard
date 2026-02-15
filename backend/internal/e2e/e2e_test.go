//go:build e2e

package e2e

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

const baseURL = "http://localhost:8080"

func apiGet(t *testing.T, path string) (int, []byte) {
	t.Helper()
	resp, err := http.Get(baseURL + path)
	if err != nil {
		t.Fatalf("GET %s failed: %v", path, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, body
}

func apiPost(t *testing.T, path string, jsonBody string) (int, []byte) {
	t.Helper()
	resp, err := http.Post(baseURL+path, "application/json", strings.NewReader(jsonBody))
	if err != nil {
		t.Fatalf("POST %s failed: %v", path, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, body
}

func TestHealthz(t *testing.T) {
	status, body := apiGet(t, "/healthz")
	if status != 200 {
		t.Fatalf("expected 200, got %d: %s", status, body)
	}

	var result map[string]string
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if result["status"] != "ok" {
		t.Fatalf("expected status 'ok', got %q", result["status"])
	}
}

func TestAuthConfig(t *testing.T) {
	status, body := apiGet(t, "/api/auth/config")
	if status != 200 {
		t.Fatalf("expected 200, got %d: %s", status, body)
	}

	var result map[string]string
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if result["mode"] != "none" {
		t.Fatalf("expected mode 'none', got %q", result["mode"])
	}
}

func TestDashboardStats(t *testing.T) {
	status, body := apiGet(t, "/api/dashboard/stats")
	if status != 200 {
		t.Fatalf("expected 200, got %d: %s", status, body)
	}

	var stats map[string]interface{}
	if err := json.Unmarshal(body, &stats); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	// Should have all expected fields
	expectedFields := []string{
		"totalBackups", "completedBackups", "failedBackups",
		"totalRestores", "totalSchedules", "activeSchedules",
		"storageLocations", "healthyLocations",
	}
	for _, field := range expectedFields {
		if _, ok := stats[field]; !ok {
			t.Errorf("missing field %q in dashboard stats", field)
		}
	}
}

func TestListBackups(t *testing.T) {
	status, body := apiGet(t, "/api/backups")
	if status != 200 {
		t.Fatalf("expected 200, got %d: %s", status, body)
	}

	var backups []interface{}
	if err := json.Unmarshal(body, &backups); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	// Fresh cluster should have no backups
	t.Logf("Found %d backups", len(backups))
}

func TestCreateAndDeleteBackup(t *testing.T) {
	backupName := fmt.Sprintf("e2e-test-%d", time.Now().Unix())

	// Create backup
	status, body := apiPost(t, "/api/backups", fmt.Sprintf(`{
		"name": %q,
		"includedNamespaces": ["default"],
		"ttl": "1h"
	}`, backupName))

	if status != 200 && status != 201 {
		t.Fatalf("create backup: expected 200/201, got %d: %s", status, body)
	}

	// Verify backup exists in list
	status, body = apiGet(t, "/api/backups")
	if status != 200 {
		t.Fatalf("list backups: expected 200, got %d: %s", status, body)
	}

	var backups []map[string]interface{}
	if err := json.Unmarshal(body, &backups); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	found := false
	for _, b := range backups {
		if b["name"] == backupName {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("backup %q not found in list", backupName)
	}

	// Delete backup
	req, _ := http.NewRequest("DELETE", baseURL+"/api/backups/"+backupName, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("delete backup failed: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("delete backup: expected 200, got %d", resp.StatusCode)
	}
}

func TestListSchedules(t *testing.T) {
	status, body := apiGet(t, "/api/schedules")
	if status != 200 {
		t.Fatalf("expected 200, got %d: %s", status, body)
	}

	var schedules []interface{}
	if err := json.Unmarshal(body, &schedules); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	t.Logf("Found %d schedules", len(schedules))
}

func TestListRestores(t *testing.T) {
	status, body := apiGet(t, "/api/restores")
	if status != 200 {
		t.Fatalf("expected 200, got %d: %s", status, body)
	}

	var restores []interface{}
	if err := json.Unmarshal(body, &restores); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	t.Logf("Found %d restores", len(restores))
}

func TestBackupStorageLocations(t *testing.T) {
	status, body := apiGet(t, "/api/settings/backup-locations")
	if status != 200 {
		t.Fatalf("expected 200, got %d: %s", status, body)
	}

	var bsls []map[string]interface{}
	if err := json.Unmarshal(body, &bsls); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	// Velero install creates a default BSL
	if len(bsls) == 0 {
		t.Fatal("expected at least one BSL from Velero install")
	}

	// Check default BSL is available
	for _, bsl := range bsls {
		if bsl["name"] == "default" {
			if bsl["phase"] != "Available" {
				t.Errorf("default BSL phase is %q, expected 'Available'", bsl["phase"])
			}
			return
		}
	}
	t.Log("default BSL not found, but other BSLs exist")
}

func TestClusterEndpoints(t *testing.T) {
	// List clusters
	status, body := apiGet(t, "/api/clusters")
	if status != 200 {
		t.Fatalf("expected 200, got %d: %s", status, body)
	}

	var clusters []map[string]interface{}
	if err := json.Unmarshal(body, &clusters); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	// Legacy migration should have created a default cluster
	if len(clusters) == 0 {
		t.Fatal("expected at least one cluster (from legacy migration)")
	}

	// Verify default cluster
	defaultFound := false
	for _, c := range clusters {
		if c["isDefault"] == true {
			defaultFound = true
			if c["status"] != "connected" {
				t.Errorf("default cluster status is %q, expected 'connected'", c["status"])
			}
		}
	}
	if !defaultFound {
		t.Error("no default cluster found")
	}
}
