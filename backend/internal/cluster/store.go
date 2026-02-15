package cluster

import (
	"context"
	"fmt"

	"go.uber.org/zap"
	"k8s.io/client-go/rest"
)

// Store defines the interface for cluster configuration storage
type Store interface {
	Create(ctx context.Context, req CreateClusterRequest) (*Cluster, error)
	Get(ctx context.Context, id string) (*Cluster, error)
	List(ctx context.Context) ([]*ClusterSummary, error)
	Update(ctx context.Context, id string, req UpdateClusterRequest) error
	Delete(ctx context.Context, id string) error
	UpdateStatus(ctx context.Context, id, status, message string) error
	GetDefault(ctx context.Context) (*Cluster, error)
	Close() error
}

// StoreConfig holds configuration for store creation
type StoreConfig struct {
	StorageType   string // "sqlite" or "kubernetes"
	DBPath        string // SQLite database path
	EncryptionKey string // AES encryption key (32 bytes)
	Namespace     string // K8s namespace for ConfigMap/Secrets
	ConfigMapName string // ConfigMap name for cluster metadata
}

// NewStore creates a new store based on configuration
func NewStore(cfg StoreConfig, logger *zap.Logger) (Store, error) {
	switch cfg.StorageType {
	case "kubernetes":
		return NewK8sStore(cfg.Namespace, cfg.ConfigMapName, logger)
	case "sqlite":
		return NewSQLiteStore(cfg.DBPath, cfg.EncryptionKey, logger)
	case "auto", "":
		// Auto-detect: use K8s if in-cluster, otherwise SQLite
		if isInCluster() {
			logger.Info("Auto-detected in-cluster environment, using Kubernetes storage")
			return NewK8sStore(cfg.Namespace, cfg.ConfigMapName, logger)
		}
		logger.Info("Auto-detected local environment, using SQLite storage")
		return NewSQLiteStore(cfg.DBPath, cfg.EncryptionKey, logger)
	default:
		return nil, fmt.Errorf("unknown storage type: %s", cfg.StorageType)
	}
}

// isInCluster checks if we're running inside a Kubernetes cluster
func isInCluster() bool {
	_, err := rest.InClusterConfig()
	return err == nil
}
