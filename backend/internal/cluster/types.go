package cluster

import (
	"time"
)

// Cluster represents a Kubernetes cluster configuration
type Cluster struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	KubeconfigRaw   []byte    `json:"-"` // Never expose in API
	Namespace       string    `json:"namespace"`
	Status          string    `json:"status"` // "connected", "disconnected", "error"
	StatusMessage   string    `json:"statusMessage,omitempty"`
	IsDefault       bool      `json:"isDefault"`
	CreatedAt       time.Time `json:"createdAt"`
	LastHealthCheck time.Time `json:"lastHealthCheck"`
}

// ClusterSummary is returned to frontend (without kubeconfig)
type ClusterSummary struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Namespace       string    `json:"namespace"`
	Status          string    `json:"status"`
	StatusMessage   string    `json:"statusMessage,omitempty"`
	IsDefault       bool      `json:"isDefault"`
	CreatedAt       time.Time `json:"createdAt"`
	LastHealthCheck time.Time `json:"lastHealthCheck"`
}

// CreateClusterRequest for adding new cluster
type CreateClusterRequest struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	SetAsDefault bool   `json:"setAsDefault"`

	// Auth Mode 1: Kubeconfig (traditional)
	Kubeconfig string `json:"kubeconfig,omitempty"` // base64 encoded or raw YAML

	// Auth Mode 2: Token-based (alternative)
	APIServer       string `json:"apiServer,omitempty"`       // e.g., https://k8s.example.com:6443
	Token           string `json:"token,omitempty"`           // Bearer token
	CACert          string `json:"caCert,omitempty"`          // CA certificate (optional)
	InsecureSkipTLS bool   `json:"insecureSkipTLS,omitempty"` // Skip TLS verification
}

// UpdateClusterRequest for updating cluster
type UpdateClusterRequest struct {
	Name         *string `json:"name,omitempty"`
	Kubeconfig   *string `json:"kubeconfig,omitempty"`
	Namespace    *string `json:"namespace,omitempty"`
	SetAsDefault *bool   `json:"setAsDefault,omitempty"`
}

// ToSummary converts Cluster to ClusterSummary (without sensitive data)
func (c *Cluster) ToSummary() *ClusterSummary {
	return &ClusterSummary{
		ID:              c.ID,
		Name:            c.Name,
		Namespace:       c.Namespace,
		Status:          c.Status,
		StatusMessage:   c.StatusMessage,
		IsDefault:       c.IsDefault,
		CreatedAt:       c.CreatedAt,
		LastHealthCheck: c.LastHealthCheck,
	}
}
