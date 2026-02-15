package cluster

import (
	"context"
	"os"
	"testing"

	"go.uber.org/zap"
)

func newTestSQLiteStore(t *testing.T) (*SQLiteStore, func()) {
	t.Helper()
	tmpFile, err := os.CreateTemp("", "test-clusters-*.db")
	if err != nil {
		t.Fatal(err)
	}
	_ = tmpFile.Close()

	logger, _ := zap.NewDevelopment()
	store, err := NewSQLiteStore(tmpFile.Name(), "test-key-32-bytes-long-padding!!", logger)
	if err != nil {
		_ = os.Remove(tmpFile.Name())
		t.Fatal(err)
	}

	cleanup := func() {
		_ = store.Close()
		_ = os.Remove(tmpFile.Name())
	}

	return store, cleanup
}

func TestSQLiteStoreCreateAndGet(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	cluster, err := store.Create(ctx, CreateClusterRequest{
		Name:         "test-cluster",
		Kubeconfig:   "apiVersion: v1\nkind: Config",
		Namespace:    "velero",
		SetAsDefault: true,
	})
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	if cluster.ID == "" {
		t.Fatal("Expected non-empty ID")
	}
	if cluster.Name != "test-cluster" {
		t.Errorf("Expected name 'test-cluster', got %q", cluster.Name)
	}
	if cluster.Namespace != "velero" {
		t.Errorf("Expected namespace 'velero', got %q", cluster.Namespace)
	}
	if !cluster.IsDefault {
		t.Error("Expected cluster to be default")
	}
	if cluster.Status != "pending" {
		t.Errorf("Expected status 'pending', got %q", cluster.Status)
	}

	// Get and verify decryption roundtrip
	got, err := store.Get(ctx, cluster.ID)
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if string(got.KubeconfigRaw) != "apiVersion: v1\nkind: Config" {
		t.Errorf("Kubeconfig mismatch after decrypt: %q", string(got.KubeconfigRaw))
	}
	if got.Name != "test-cluster" {
		t.Errorf("Expected name 'test-cluster', got %q", got.Name)
	}
}

func TestSQLiteStoreGetNotFound(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	_, err := store.Get(context.Background(), "nonexistent-id")
	if err == nil {
		t.Fatal("Expected error for nonexistent cluster")
	}
}

func TestSQLiteStoreList(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	// Empty list
	list, err := store.List(ctx)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("Expected empty list, got %d", len(list))
	}

	// Create two clusters
	_, _ = store.Create(ctx, CreateClusterRequest{
		Name: "cluster-a", Kubeconfig: "kc-a", Namespace: "velero", SetAsDefault: true,
	})
	_, _ = store.Create(ctx, CreateClusterRequest{
		Name: "cluster-b", Kubeconfig: "kc-b", Namespace: "backup",
	})

	list, err = store.List(ctx)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("Expected 2 clusters, got %d", len(list))
	}

	// Default cluster should be first (ORDER BY is_default DESC)
	if list[0].Name != "cluster-a" {
		t.Errorf("Expected default cluster first, got %q", list[0].Name)
	}
}

func TestSQLiteStoreUpdate(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	cluster, _ := store.Create(ctx, CreateClusterRequest{
		Name: "original", Kubeconfig: "kc", Namespace: "velero",
	})

	newName := "updated-name"
	newNs := "new-ns"
	err := store.Update(ctx, cluster.ID, UpdateClusterRequest{
		Name:      &newName,
		Namespace: &newNs,
	})
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	got, _ := store.Get(ctx, cluster.ID)
	if got.Name != "updated-name" {
		t.Errorf("Expected name 'updated-name', got %q", got.Name)
	}
	if got.Namespace != "new-ns" {
		t.Errorf("Expected namespace 'new-ns', got %q", got.Namespace)
	}
}

func TestSQLiteStoreUpdateKubeconfig(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	cluster, _ := store.Create(ctx, CreateClusterRequest{
		Name: "test", Kubeconfig: "old-kc", Namespace: "velero",
	})

	newKc := "new-kubeconfig-data"
	err := store.Update(ctx, cluster.ID, UpdateClusterRequest{
		Kubeconfig: &newKc,
	})
	if err != nil {
		t.Fatalf("Update kubeconfig failed: %v", err)
	}

	got, _ := store.Get(ctx, cluster.ID)
	if string(got.KubeconfigRaw) != "new-kubeconfig-data" {
		t.Errorf("Kubeconfig not updated: %q", string(got.KubeconfigRaw))
	}
}

func TestSQLiteStoreDelete(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	cluster, _ := store.Create(ctx, CreateClusterRequest{
		Name: "to-delete", Kubeconfig: "kc", Namespace: "velero",
	})

	err := store.Delete(ctx, cluster.ID)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	_, err = store.Get(ctx, cluster.ID)
	if err == nil {
		t.Fatal("Expected error after delete")
	}

	// Delete nonexistent
	err = store.Delete(ctx, "nonexistent")
	if err == nil {
		t.Fatal("Expected error deleting nonexistent cluster")
	}
}

func TestSQLiteStoreUpdateStatus(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	cluster, _ := store.Create(ctx, CreateClusterRequest{
		Name: "status-test", Kubeconfig: "kc", Namespace: "velero",
	})

	err := store.UpdateStatus(ctx, cluster.ID, "connected", "")
	if err != nil {
		t.Fatalf("UpdateStatus failed: %v", err)
	}

	got, _ := store.Get(ctx, cluster.ID)
	if got.Status != "connected" {
		t.Errorf("Expected status 'connected', got %q", got.Status)
	}

	err = store.UpdateStatus(ctx, cluster.ID, "error", "connection refused")
	if err != nil {
		t.Fatalf("UpdateStatus failed: %v", err)
	}

	got, _ = store.Get(ctx, cluster.ID)
	if got.Status != "error" {
		t.Errorf("Expected status 'error', got %q", got.Status)
	}
	if got.StatusMessage != "connection refused" {
		t.Errorf("Expected message 'connection refused', got %q", got.StatusMessage)
	}
	if got.LastHealthCheck.IsZero() {
		t.Error("Expected non-zero last health check")
	}
}

func TestSQLiteStoreGetDefault(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	// No default
	_, err := store.GetDefault(ctx)
	if err == nil {
		t.Fatal("Expected error when no default cluster")
	}

	// Create default
	_, _ = store.Create(ctx, CreateClusterRequest{
		Name: "default-cluster", Kubeconfig: "kc", Namespace: "velero", SetAsDefault: true,
	})

	got, err := store.GetDefault(ctx)
	if err != nil {
		t.Fatalf("GetDefault failed: %v", err)
	}
	if got.Name != "default-cluster" {
		t.Errorf("Expected 'default-cluster', got %q", got.Name)
	}
}

func TestSQLiteStoreDefaultSwitching(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	// Create first as default
	c1, _ := store.Create(ctx, CreateClusterRequest{
		Name: "first", Kubeconfig: "kc1", Namespace: "velero", SetAsDefault: true,
	})

	// Create second as default (should clear first)
	c2, _ := store.Create(ctx, CreateClusterRequest{
		Name: "second", Kubeconfig: "kc2", Namespace: "velero", SetAsDefault: true,
	})

	// First should no longer be default
	got1, _ := store.Get(ctx, c1.ID)
	if got1.IsDefault {
		t.Error("First cluster should not be default anymore")
	}

	got2, _ := store.Get(ctx, c2.ID)
	if !got2.IsDefault {
		t.Error("Second cluster should be default")
	}

	// GetDefault should return second
	def, _ := store.GetDefault(ctx)
	if def.Name != "second" {
		t.Errorf("Expected default 'second', got %q", def.Name)
	}
}

func TestSQLiteStoreDuplicateName(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	ctx := context.Background()

	_, _ = store.Create(ctx, CreateClusterRequest{
		Name: "duplicate", Kubeconfig: "kc", Namespace: "velero",
	})

	_, err := store.Create(ctx, CreateClusterRequest{
		Name: "duplicate", Kubeconfig: "kc2", Namespace: "velero",
	})
	if err == nil {
		t.Fatal("Expected error for duplicate name")
	}
}

func TestSQLiteStoreEncryptionRoundtrip(t *testing.T) {
	store, cleanup := newTestSQLiteStore(t)
	defer cleanup()

	// Test encryption/decryption directly
	original := []byte("sensitive kubeconfig data with special chars: !@#$%^&*()")
	encrypted, err := store.encrypt(original)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// Encrypted should be different from original
	if string(encrypted) == string(original) {
		t.Error("Encrypted data should differ from original")
	}

	decrypted, err := store.decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if string(decrypted) != string(original) {
		t.Errorf("Decrypted mismatch: got %q, want %q", string(decrypted), string(original))
	}
}

func TestSQLiteStoreAutoGenerateKey(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "test-clusters-*.db")
	if err != nil {
		t.Fatal(err)
	}
	_ = tmpFile.Close()
	defer func() { _ = os.Remove(tmpFile.Name()) }()

	logger, _ := zap.NewDevelopment()

	// Empty key should auto-generate
	store, err := NewSQLiteStore(tmpFile.Name(), "", logger)
	if err != nil {
		t.Fatalf("Expected auto-generated key: %v", err)
	}
	defer func() { _ = store.Close() }()

	// Should still work with the auto-generated key
	ctx := context.Background()
	c, err := store.Create(ctx, CreateClusterRequest{
		Name: "test", Kubeconfig: "kc", Namespace: "velero",
	})
	if err != nil {
		t.Fatalf("Create with auto key failed: %v", err)
	}

	got, err := store.Get(ctx, c.ID)
	if err != nil {
		t.Fatalf("Get with auto key failed: %v", err)
	}
	if string(got.KubeconfigRaw) != "kc" {
		t.Error("Kubeconfig mismatch with auto-generated key")
	}
}
