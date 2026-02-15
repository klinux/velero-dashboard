package k8s

import (
	"context"
	"fmt"

	"go.uber.org/zap"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

// NewClientFromKubeconfig creates a client from raw kubeconfig bytes
func NewClientFromKubeconfig(kubeconfigData []byte, namespace string, logger *zap.Logger) (*Client, error) {
	cfg, err := clientcmd.RESTConfigFromKubeConfig(kubeconfigData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse kubeconfig: %w", err)
	}

	dynClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	logger.Info("Created client from kubeconfig", zap.String("namespace", namespace))

	return &Client{
		dynamic:   dynClient,
		namespace: namespace,
		logger:    logger,
	}, nil
}

// NewClientFromToken creates a client from API server URL and bearer token
func NewClientFromToken(apiServer, token, caCert, namespace string, insecureSkipTLS bool, logger *zap.Logger) (*Client, error) {
	cfg := &rest.Config{
		Host:        apiServer,
		BearerToken: token,
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: insecureSkipTLS,
		},
	}

	// Add CA cert if provided
	if caCert != "" && !insecureSkipTLS {
		cfg.TLSClientConfig.CAData = []byte(caCert)
	}

	dynClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	logger.Info("Created client from token", zap.String("apiServer", apiServer), zap.String("namespace", namespace))

	return &Client{
		dynamic:   dynClient,
		namespace: namespace,
		logger:    logger,
	}, nil
}

// TestConnection verifies cluster connectivity by listing backups
func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.dynamic.Resource(BackupGVR).Namespace(c.namespace).List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}
	return nil
}
