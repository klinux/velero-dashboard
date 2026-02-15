package cluster

import (
	"testing"
	"time"
)

func TestClusterToSummary(t *testing.T) {
	now := time.Now()
	c := &Cluster{
		ID:              "test-id",
		Name:            "test-cluster",
		KubeconfigRaw:   []byte("sensitive-data"),
		Namespace:       "velero",
		Status:          "connected",
		StatusMessage:   "",
		IsDefault:       true,
		CreatedAt:       now,
		LastHealthCheck: now,
	}

	summary := c.ToSummary()

	if summary.ID != c.ID {
		t.Errorf("ID mismatch: %q vs %q", summary.ID, c.ID)
	}
	if summary.Name != c.Name {
		t.Errorf("Name mismatch: %q vs %q", summary.Name, c.Name)
	}
	if summary.Namespace != c.Namespace {
		t.Errorf("Namespace mismatch: %q vs %q", summary.Namespace, c.Namespace)
	}
	if summary.Status != c.Status {
		t.Errorf("Status mismatch: %q vs %q", summary.Status, c.Status)
	}
	if summary.IsDefault != c.IsDefault {
		t.Errorf("IsDefault mismatch: %v vs %v", summary.IsDefault, c.IsDefault)
	}
	if !summary.CreatedAt.Equal(c.CreatedAt) {
		t.Error("CreatedAt mismatch")
	}
	if !summary.LastHealthCheck.Equal(c.LastHealthCheck) {
		t.Error("LastHealthCheck mismatch")
	}
}

func TestClusterToSummaryNoKubeconfig(t *testing.T) {
	c := &Cluster{
		ID:            "id",
		Name:          "name",
		KubeconfigRaw: []byte("should-not-appear"),
	}

	// ClusterSummary struct doesn't have KubeconfigRaw field
	// This test ensures the conversion function exists and works
	summary := c.ToSummary()
	if summary.ID != "id" {
		t.Errorf("Expected ID 'id', got %q", summary.ID)
	}
}
