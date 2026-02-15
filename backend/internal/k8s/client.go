package k8s

import (
	"fmt"

	"go.uber.org/zap"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Velero CRD Group/Version/Resources
var (
	veleroGroup   = "velero.io"
	veleroVersion = "v1"

	BackupGVR = schema.GroupVersionResource{
		Group: veleroGroup, Version: veleroVersion, Resource: "backups",
	}
	RestoreGVR = schema.GroupVersionResource{
		Group: veleroGroup, Version: veleroVersion, Resource: "restores",
	}
	ScheduleGVR = schema.GroupVersionResource{
		Group: veleroGroup, Version: veleroVersion, Resource: "schedules",
	}
	BackupStorageLocationGVR = schema.GroupVersionResource{
		Group: veleroGroup, Version: veleroVersion, Resource: "backupstoragelocations",
	}
	VolumeSnapshotLocationGVR = schema.GroupVersionResource{
		Group: veleroGroup, Version: veleroVersion, Resource: "volumesnapshotlocations",
	}
	DeleteBackupRequestGVR = schema.GroupVersionResource{
		Group: veleroGroup, Version: veleroVersion, Resource: "deletebackuprequests",
	}
	DownloadRequestGVR = schema.GroupVersionResource{
		Group: veleroGroup, Version: veleroVersion, Resource: "downloadrequests",
	}
	ServerStatusRequestGVR = schema.GroupVersionResource{
		Group: veleroGroup, Version: veleroVersion, Resource: "serverstatusrequests",
	}
)

// Client wraps the Kubernetes dynamic client for Velero CRD operations.
type Client struct {
	dynamic   dynamic.Interface
	namespace string
	logger    *zap.Logger
}

// NewClient creates a Kubernetes client. If kubeconfigPath is empty,
// it falls back to in-cluster configuration (ServiceAccount).
func NewClient(kubeconfigPath, namespace string, logger *zap.Logger) (*Client, error) {
	var cfg *rest.Config
	var err error

	if kubeconfigPath != "" {
		cfg, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
		if err != nil {
			return nil, fmt.Errorf("failed to build kubeconfig: %w", err)
		}
		logger.Info("Using kubeconfig", zap.String("path", kubeconfigPath))
	} else {
		cfg, err = rest.InClusterConfig()
		if err != nil {
			return nil, fmt.Errorf("failed to get in-cluster config: %w", err)
		}
		logger.Info("Using in-cluster config")
	}

	dynClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return &Client{
		dynamic:   dynClient,
		namespace: namespace,
		logger:    logger,
	}, nil
}

// Namespace returns the configured velero namespace.
func (c *Client) Namespace() string {
	return c.namespace
}

// Dynamic returns the underlying dynamic client (used by informers).
func (c *Client) Dynamic() dynamic.Interface {
	return c.dynamic
}
