package cluster

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// K8sStore implements Store interface using Kubernetes ConfigMap and Secrets
type K8sStore struct {
	clientset     *kubernetes.Clientset
	namespace     string
	configMapName string
	logger        *zap.Logger
}

// clusterMetadata represents cluster metadata stored in ConfigMap
type clusterMetadata struct {
	Name            string    `json:"name"`
	Namespace       string    `json:"namespace"`
	SecretRef       string    `json:"secretRef"`
	Status          string    `json:"status"`
	StatusMessage   string    `json:"statusMessage,omitempty"`
	IsDefault       bool      `json:"isDefault"`
	CreatedAt       time.Time `json:"createdAt"`
	LastHealthCheck time.Time `json:"lastHealthCheck,omitempty"`
}

// NewK8sStore creates a new Kubernetes-based store
func NewK8sStore(namespace, configMapName string, logger *zap.Logger) (*K8sStore, error) {
	if namespace == "" {
		namespace = "velero"
	}
	if configMapName == "" {
		configMapName = "velero-dashboard-clusters"
	}

	// Get in-cluster config
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config: %w", err)
	}

	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	store := &K8sStore{
		clientset:     clientset,
		namespace:     namespace,
		configMapName: configMapName,
		logger:        logger,
	}

	// Ensure ConfigMap exists
	if err := store.ensureConfigMap(context.Background()); err != nil {
		return nil, err
	}

	logger.Info("Kubernetes store initialized",
		zap.String("namespace", namespace),
		zap.String("configMap", configMapName))

	return store, nil
}

// ensureConfigMap creates ConfigMap if it doesn't exist
func (s *K8sStore) ensureConfigMap(ctx context.Context) error {
	_, err := s.clientset.CoreV1().ConfigMaps(s.namespace).Get(ctx, s.configMapName, metav1.GetOptions{})
	if err == nil {
		return nil // Already exists
	}

	// Create ConfigMap with empty clusters map
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      s.configMapName,
			Namespace: s.namespace,
			Labels: map[string]string{
				"app.kubernetes.io/name":       "velero-dashboard",
				"app.kubernetes.io/component":  "cluster-config",
				"app.kubernetes.io/managed-by": "velero-dashboard",
			},
		},
		Data: map[string]string{
			"clusters.json": "{}",
		},
	}

	_, err = s.clientset.CoreV1().ConfigMaps(s.namespace).Create(ctx, cm, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create ConfigMap: %w", err)
	}

	s.logger.Info("Created ConfigMap for cluster storage")
	return nil
}

// loadMetadata loads all cluster metadata from ConfigMap
func (s *K8sStore) loadMetadata(ctx context.Context) (map[string]*clusterMetadata, error) {
	cm, err := s.clientset.CoreV1().ConfigMaps(s.namespace).Get(ctx, s.configMapName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get ConfigMap: %w", err)
	}

	data := cm.Data["clusters.json"]
	if data == "" {
		return make(map[string]*clusterMetadata), nil
	}

	var clusters map[string]*clusterMetadata
	if err := json.Unmarshal([]byte(data), &clusters); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cluster metadata: %w", err)
	}

	return clusters, nil
}

// saveMetadata saves all cluster metadata to ConfigMap
func (s *K8sStore) saveMetadata(ctx context.Context, clusters map[string]*clusterMetadata) error {
	data, err := json.MarshalIndent(clusters, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal cluster metadata: %w", err)
	}

	cm, err := s.clientset.CoreV1().ConfigMaps(s.namespace).Get(ctx, s.configMapName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get ConfigMap: %w", err)
	}

	cm.Data["clusters.json"] = string(data)

	_, err = s.clientset.CoreV1().ConfigMaps(s.namespace).Update(ctx, cm, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update ConfigMap: %w", err)
	}

	return nil
}

// Create adds a new cluster
func (s *K8sStore) Create(ctx context.Context, req CreateClusterRequest) (*Cluster, error) {
	id := uuid.New().String()
	secretName := fmt.Sprintf("velero-dashboard-cluster-%s", id)

	// Load existing metadata
	clusters, err := s.loadMetadata(ctx)
	if err != nil {
		return nil, err
	}

	// Check for duplicate name
	for _, meta := range clusters {
		if meta.Name == req.Name {
			return nil, fmt.Errorf("cluster with name %s already exists", req.Name)
		}
	}

	// If setting as default, clear other defaults
	if req.SetAsDefault {
		for _, meta := range clusters {
			meta.IsDefault = false
		}
	}

	// Create Secret with kubeconfig
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretName,
			Namespace: s.namespace,
			Labels: map[string]string{
				"app.kubernetes.io/name":       "velero-dashboard",
				"app.kubernetes.io/component":  "cluster-kubeconfig",
				"app.kubernetes.io/managed-by": "velero-dashboard",
				"velero-dashboard/cluster-id":  id,
			},
		},
		Type: corev1.SecretTypeOpaque,
		StringData: map[string]string{
			"kubeconfig": req.Kubeconfig,
		},
	}

	_, err = s.clientset.CoreV1().Secrets(s.namespace).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create Secret: %w", err)
	}

	// Add cluster metadata
	now := time.Now()
	clusters[id] = &clusterMetadata{
		Name:      req.Name,
		Namespace: req.Namespace,
		SecretRef: secretName,
		Status:    "pending",
		IsDefault: req.SetAsDefault,
		CreatedAt: now,
	}

	// Save metadata
	if err := s.saveMetadata(ctx, clusters); err != nil {
		// Cleanup secret on failure
		_ = s.clientset.CoreV1().Secrets(s.namespace).Delete(ctx, secretName, metav1.DeleteOptions{})
		return nil, err
	}

	return &Cluster{
		ID:            id,
		Name:          req.Name,
		KubeconfigRaw: []byte(req.Kubeconfig),
		Namespace:     req.Namespace,
		Status:        "pending",
		IsDefault:     req.SetAsDefault,
		CreatedAt:     now,
	}, nil
}

// Get retrieves a cluster by ID
func (s *K8sStore) Get(ctx context.Context, id string) (*Cluster, error) {
	clusters, err := s.loadMetadata(ctx)
	if err != nil {
		return nil, err
	}

	meta, exists := clusters[id]
	if !exists {
		return nil, fmt.Errorf("cluster not found")
	}

	// Get kubeconfig from Secret
	secret, err := s.clientset.CoreV1().Secrets(s.namespace).Get(ctx, meta.SecretRef, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get Secret: %w", err)
	}

	kubeconfig := secret.Data["kubeconfig"]
	if len(kubeconfig) == 0 {
		return nil, fmt.Errorf("kubeconfig not found in Secret")
	}

	return &Cluster{
		ID:              id,
		Name:            meta.Name,
		KubeconfigRaw:   kubeconfig,
		Namespace:       meta.Namespace,
		Status:          meta.Status,
		StatusMessage:   meta.StatusMessage,
		IsDefault:       meta.IsDefault,
		CreatedAt:       meta.CreatedAt,
		LastHealthCheck: meta.LastHealthCheck,
	}, nil
}

// List returns all clusters (without kubeconfig)
func (s *K8sStore) List(ctx context.Context) ([]*ClusterSummary, error) {
	clusters, err := s.loadMetadata(ctx)
	if err != nil {
		return nil, err
	}

	summaries := make([]*ClusterSummary, 0, len(clusters))
	for id, meta := range clusters {
		summaries = append(summaries, &ClusterSummary{
			ID:              id,
			Name:            meta.Name,
			Namespace:       meta.Namespace,
			Status:          meta.Status,
			StatusMessage:   meta.StatusMessage,
			IsDefault:       meta.IsDefault,
			CreatedAt:       meta.CreatedAt,
			LastHealthCheck: meta.LastHealthCheck,
		})
	}

	return summaries, nil
}

// Update modifies cluster configuration
func (s *K8sStore) Update(ctx context.Context, id string, req UpdateClusterRequest) error {
	clusters, err := s.loadMetadata(ctx)
	if err != nil {
		return err
	}

	meta, exists := clusters[id]
	if !exists {
		return fmt.Errorf("cluster not found")
	}

	// If setting as default, clear other defaults
	if req.SetAsDefault != nil && *req.SetAsDefault {
		for _, m := range clusters {
			m.IsDefault = false
		}
	}

	// Update metadata
	if req.Name != nil {
		meta.Name = *req.Name
	}
	if req.Namespace != nil {
		meta.Namespace = *req.Namespace
	}
	if req.SetAsDefault != nil {
		meta.IsDefault = *req.SetAsDefault
	}

	// Update kubeconfig in Secret if provided
	if req.Kubeconfig != nil {
		secret, err := s.clientset.CoreV1().Secrets(s.namespace).Get(ctx, meta.SecretRef, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get Secret: %w", err)
		}

		secret.StringData = map[string]string{
			"kubeconfig": *req.Kubeconfig,
		}

		_, err = s.clientset.CoreV1().Secrets(s.namespace).Update(ctx, secret, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update Secret: %w", err)
		}
	}

	return s.saveMetadata(ctx, clusters)
}

// Delete removes a cluster
func (s *K8sStore) Delete(ctx context.Context, id string) error {
	clusters, err := s.loadMetadata(ctx)
	if err != nil {
		return err
	}

	meta, exists := clusters[id]
	if !exists {
		return fmt.Errorf("cluster not found")
	}

	// Delete Secret
	err = s.clientset.CoreV1().Secrets(s.namespace).Delete(ctx, meta.SecretRef, metav1.DeleteOptions{})
	if err != nil {
		s.logger.Warn("Failed to delete Secret", zap.String("secret", meta.SecretRef), zap.Error(err))
	}

	// Remove from metadata
	delete(clusters, id)

	return s.saveMetadata(ctx, clusters)
}

// UpdateStatus updates cluster connection status
func (s *K8sStore) UpdateStatus(ctx context.Context, id, status, message string) error {
	clusters, err := s.loadMetadata(ctx)
	if err != nil {
		return err
	}

	meta, exists := clusters[id]
	if !exists {
		return fmt.Errorf("cluster not found")
	}

	meta.Status = status
	meta.StatusMessage = message
	meta.LastHealthCheck = time.Now()

	return s.saveMetadata(ctx, clusters)
}

// GetDefault returns the default cluster
func (s *K8sStore) GetDefault(ctx context.Context) (*Cluster, error) {
	clusters, err := s.loadMetadata(ctx)
	if err != nil {
		return nil, err
	}

	for id, meta := range clusters {
		if meta.IsDefault {
			return s.Get(ctx, id)
		}
	}

	return nil, fmt.Errorf("no default cluster configured")
}

// Close is a no-op for K8s store
func (s *K8sStore) Close() error {
	return nil
}

// WatchSecrets watches for externally created/deleted Secrets and syncs to ConfigMap metadata.
// This enables declarative/GitOps workflows where admins create Secrets via kubectl/Helm.
// Secrets must have label: app.kubernetes.io/component=cluster-kubeconfig
// and annotations: velero-dashboard/cluster-name, velero-dashboard/cluster-namespace
func (s *K8sStore) WatchSecrets(ctx context.Context, onChange func()) error {
	labelSelector := "app.kubernetes.io/name=velero-dashboard,app.kubernetes.io/component=cluster-kubeconfig"

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		watcher, err := s.clientset.CoreV1().Secrets(s.namespace).Watch(ctx, metav1.ListOptions{
			LabelSelector: labelSelector,
		})
		if err != nil {
			s.logger.Error("Failed to watch Secrets", zap.Error(err))
			time.Sleep(5 * time.Second)
			continue
		}

		// Initial reconciliation on watch start
		if changed := s.reconcileSecrets(ctx); changed {
			onChange()
		}

		s.logger.Info("Started watching Secrets for external cluster changes",
			zap.String("namespace", s.namespace),
			zap.String("labelSelector", labelSelector))

		func() {
			defer watcher.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case event, ok := <-watcher.ResultChan():
					if !ok {
						s.logger.Warn("Secret watch channel closed, restarting")
						return
					}

					switch event.Type {
					case watch.Added, watch.Deleted, watch.Modified:
						secret, ok := event.Object.(*corev1.Secret)
						if !ok {
							continue
						}
						s.logger.Info("Secret change detected",
							zap.String("type", string(event.Type)),
							zap.String("secret", secret.Name))

						if changed := s.reconcileSecrets(ctx); changed {
							onChange()
						}
					}
				}
			}
		}()

		// Brief pause before reconnecting
		time.Sleep(time.Second)
	}
}

// reconcileSecrets compares Secrets in the namespace with ConfigMap metadata
// and adds/removes entries as needed. Returns true if changes were made.
func (s *K8sStore) reconcileSecrets(ctx context.Context) bool {
	labelSelector := "app.kubernetes.io/name=velero-dashboard,app.kubernetes.io/component=cluster-kubeconfig"

	// List all Secrets with our labels
	secrets, err := s.clientset.CoreV1().Secrets(s.namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		s.logger.Error("Failed to list Secrets for reconciliation", zap.Error(err))
		return false
	}

	// Load current metadata
	clusters, err := s.loadMetadata(ctx)
	if err != nil {
		s.logger.Error("Failed to load metadata for reconciliation", zap.Error(err))
		return false
	}

	changed := false

	// Build a set of Secret names that exist
	existingSecrets := make(map[string]bool)
	for _, secret := range secrets.Items {
		existingSecrets[secret.Name] = true
	}

	// Build a reverse map: secretRef -> clusterID
	secretToCluster := make(map[string]string)
	for id, meta := range clusters {
		secretToCluster[meta.SecretRef] = id
	}

	// Check for new Secrets not in ConfigMap
	for _, secret := range secrets.Items {
		if _, exists := secretToCluster[secret.Name]; exists {
			continue // Already tracked
		}

		// Check if Secret has kubeconfig data
		if _, hasKubeconfig := secret.Data["kubeconfig"]; !hasKubeconfig {
			continue
		}

		// Extract cluster info from annotations
		annotations := secret.Annotations
		clusterName := annotations["velero-dashboard/cluster-name"]
		if clusterName == "" {
			// Check label as fallback
			clusterName = secret.Labels["velero-dashboard/cluster-id"]
			if clusterName == "" {
				s.logger.Warn("Secret missing cluster-name annotation, skipping",
					zap.String("secret", secret.Name))
				continue
			}
		}

		clusterNamespace := annotations["velero-dashboard/cluster-namespace"]
		if clusterNamespace == "" {
			clusterNamespace = "velero"
		}

		isDefault := annotations["velero-dashboard/is-default"] == "true"

		// Generate ID for the new cluster
		id := uuid.New().String()

		// If setting as default, clear others
		if isDefault {
			for _, m := range clusters {
				m.IsDefault = false
			}
		}

		clusters[id] = &clusterMetadata{
			Name:      clusterName,
			Namespace: clusterNamespace,
			SecretRef: secret.Name,
			Status:    "pending",
			IsDefault: isDefault,
			CreatedAt: secret.CreationTimestamp.Time,
		}

		s.logger.Info("Discovered external cluster Secret",
			zap.String("id", id),
			zap.String("name", clusterName),
			zap.String("secret", secret.Name))
		changed = true
	}

	// Check for clusters whose Secrets have been deleted
	for id, meta := range clusters {
		if !existingSecrets[meta.SecretRef] {
			s.logger.Info("Cluster Secret deleted externally, removing from metadata",
				zap.String("id", id),
				zap.String("name", meta.Name),
				zap.String("secret", meta.SecretRef))
			delete(clusters, id)
			changed = true
		}
	}

	// Save if changes were made
	if changed {
		if err := s.saveMetadata(ctx, clusters); err != nil {
			s.logger.Error("Failed to save reconciled metadata", zap.Error(err))
			return false
		}
		s.logger.Info("Reconciliation complete", zap.Int("totalClusters", len(clusters)))
	}

	return changed
}
