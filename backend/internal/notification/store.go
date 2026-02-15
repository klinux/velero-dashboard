package notification

import (
	"context"
	"fmt"

	"go.uber.org/zap"
	"k8s.io/client-go/rest"
)

// Store is the interface for webhook configuration persistence.
type Store interface {
	Create(ctx context.Context, req CreateWebhookRequest) (*WebhookConfig, error)
	Get(ctx context.Context, id string) (*WebhookConfig, error)
	List(ctx context.Context) ([]*WebhookConfig, error)
	Update(ctx context.Context, id string, req UpdateWebhookRequest) error
	Delete(ctx context.Context, id string) error
	UpdateDeliveryStatus(ctx context.Context, id string, status string, errMsg string) error
	Close() error
}

// StoreConfig holds configuration for creating a notification store.
type StoreConfig struct {
	StorageType string // "auto", "kubernetes", "sqlite"
	DBPath      string // For SQLite
	Namespace   string // For Kubernetes
}

// NewStore creates a notification store based on the storage type.
func NewStore(cfg StoreConfig, logger *zap.Logger) (Store, error) {
	storageType := cfg.StorageType
	if storageType == "" || storageType == "auto" {
		if isInCluster() {
			storageType = "kubernetes"
		} else {
			storageType = "sqlite"
		}
	}

	switch storageType {
	case "kubernetes":
		return NewK8sStore(cfg.Namespace, logger)
	case "sqlite":
		dbPath := cfg.DBPath
		if dbPath == "" {
			dbPath = "./webhooks.db"
		}
		return NewSQLiteStore(dbPath, logger)
	default:
		return nil, fmt.Errorf("unknown notification storage type: %s", storageType)
	}
}

func isInCluster() bool {
	_, err := rest.InClusterConfig()
	return err == nil
}
