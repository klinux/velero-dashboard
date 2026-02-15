package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	webhookConfigMapName = "velero-dashboard-webhooks"
	webhookSecretName    = "velero-dashboard-webhook-urls"
	webhookDataKey       = "webhooks.json"
)

// K8sStore stores webhook configurations in Kubernetes ConfigMap + Secret.
type K8sStore struct {
	clientset kubernetes.Interface
	namespace string
	logger    *zap.Logger
}

// webhookMetadata is the metadata stored in the ConfigMap (no URLs).
type webhookMetadata struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	Type       WebhookType `json:"type"`
	Events     []EventType `json:"events"`
	Enabled    bool        `json:"enabled"`
	CreatedAt  time.Time   `json:"createdAt"`
	UpdatedAt  time.Time   `json:"updatedAt"`
	LastSentAt *time.Time  `json:"lastSentAt,omitempty"`
	LastStatus string      `json:"lastStatus,omitempty"`
	LastError  string      `json:"lastError,omitempty"`
}

// NewK8sStore creates a new Kubernetes notification store.
func NewK8sStore(namespace string, logger *zap.Logger) (*K8sStore, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	s := &K8sStore{
		clientset: clientset,
		namespace: namespace,
		logger:    logger,
	}

	if err := s.ensureResources(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ensure resources: %w", err)
	}

	return s, nil
}

func (s *K8sStore) ensureResources(ctx context.Context) error {
	labels := map[string]string{
		"app.kubernetes.io/name":      "velero-dashboard",
		"app.kubernetes.io/component": "webhook-config",
	}

	// Ensure ConfigMap
	_, err := s.clientset.CoreV1().ConfigMaps(s.namespace).Get(ctx, webhookConfigMapName, metav1.GetOptions{})
	if errors.IsNotFound(err) {
		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:   webhookConfigMapName,
				Labels: labels,
			},
			Data: map[string]string{webhookDataKey: "{}"},
		}
		_, err = s.clientset.CoreV1().ConfigMaps(s.namespace).Create(ctx, cm, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create configmap: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("failed to get configmap: %w", err)
	}

	// Ensure Secret
	_, err = s.clientset.CoreV1().Secrets(s.namespace).Get(ctx, webhookSecretName, metav1.GetOptions{})
	if errors.IsNotFound(err) {
		secret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:   webhookSecretName,
				Labels: labels,
			},
			Type: corev1.SecretTypeOpaque,
			Data: map[string][]byte{},
		}
		_, err = s.clientset.CoreV1().Secrets(s.namespace).Create(ctx, secret, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create secret: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("failed to get secret: %w", err)
	}

	return nil
}

func (s *K8sStore) loadMetadata(ctx context.Context) (map[string]*webhookMetadata, error) {
	cm, err := s.clientset.CoreV1().ConfigMaps(s.namespace).Get(ctx, webhookConfigMapName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get configmap: %w", err)
	}

	data := cm.Data[webhookDataKey]
	if data == "" {
		return make(map[string]*webhookMetadata), nil
	}

	var metadata map[string]*webhookMetadata
	if err := json.Unmarshal([]byte(data), &metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}
	return metadata, nil
}

func (s *K8sStore) saveMetadata(ctx context.Context, metadata map[string]*webhookMetadata) error {
	data, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	cm, err := s.clientset.CoreV1().ConfigMaps(s.namespace).Get(ctx, webhookConfigMapName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get configmap: %w", err)
	}

	if cm.Data == nil {
		cm.Data = make(map[string]string)
	}
	cm.Data[webhookDataKey] = string(data)

	_, err = s.clientset.CoreV1().ConfigMaps(s.namespace).Update(ctx, cm, metav1.UpdateOptions{})
	return err
}

func (s *K8sStore) loadURLs(ctx context.Context) (map[string]string, error) {
	secret, err := s.clientset.CoreV1().Secrets(s.namespace).Get(ctx, webhookSecretName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get secret: %w", err)
	}

	urls := make(map[string]string, len(secret.Data))
	for k, v := range secret.Data {
		urls[k] = string(v)
	}
	return urls, nil
}

func (s *K8sStore) saveURL(ctx context.Context, id string, url string) error {
	secret, err := s.clientset.CoreV1().Secrets(s.namespace).Get(ctx, webhookSecretName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get secret: %w", err)
	}

	if secret.Data == nil {
		secret.Data = make(map[string][]byte)
	}
	secret.Data[id] = []byte(url)

	_, err = s.clientset.CoreV1().Secrets(s.namespace).Update(ctx, secret, metav1.UpdateOptions{})
	return err
}

func (s *K8sStore) deleteURL(ctx context.Context, id string) error {
	secret, err := s.clientset.CoreV1().Secrets(s.namespace).Get(ctx, webhookSecretName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get secret: %w", err)
	}

	delete(secret.Data, id)
	_, err = s.clientset.CoreV1().Secrets(s.namespace).Update(ctx, secret, metav1.UpdateOptions{})
	return err
}

func (s *K8sStore) Create(ctx context.Context, req CreateWebhookRequest) (*WebhookConfig, error) {
	id := uuid.New().String()
	now := time.Now()

	metadata, err := s.loadMetadata(ctx)
	if err != nil {
		return nil, err
	}

	metadata[id] = &webhookMetadata{
		ID:        id,
		Name:      req.Name,
		Type:      req.Type,
		Events:    req.Events,
		Enabled:   req.Enabled,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.saveMetadata(ctx, metadata); err != nil {
		return nil, err
	}

	if err := s.saveURL(ctx, id, req.URL); err != nil {
		return nil, err
	}

	return &WebhookConfig{
		ID:        id,
		Name:      req.Name,
		Type:      req.Type,
		URL:       req.URL,
		Events:    req.Events,
		Enabled:   req.Enabled,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (s *K8sStore) Get(ctx context.Context, id string) (*WebhookConfig, error) {
	metadata, err := s.loadMetadata(ctx)
	if err != nil {
		return nil, err
	}

	meta, ok := metadata[id]
	if !ok {
		return nil, fmt.Errorf("webhook not found: %s", id)
	}

	urls, err := s.loadURLs(ctx)
	if err != nil {
		return nil, err
	}

	return &WebhookConfig{
		ID:         meta.ID,
		Name:       meta.Name,
		Type:       meta.Type,
		URL:        urls[id],
		Events:     meta.Events,
		Enabled:    meta.Enabled,
		CreatedAt:  meta.CreatedAt,
		UpdatedAt:  meta.UpdatedAt,
		LastSentAt: meta.LastSentAt,
		LastStatus: meta.LastStatus,
		LastError:  meta.LastError,
	}, nil
}

func (s *K8sStore) List(ctx context.Context) ([]*WebhookConfig, error) {
	metadata, err := s.loadMetadata(ctx)
	if err != nil {
		return nil, err
	}

	urls, err := s.loadURLs(ctx)
	if err != nil {
		return nil, err
	}

	var results []*WebhookConfig
	for id, meta := range metadata {
		results = append(results, &WebhookConfig{
			ID:         meta.ID,
			Name:       meta.Name,
			Type:       meta.Type,
			URL:        urls[id],
			Events:     meta.Events,
			Enabled:    meta.Enabled,
			CreatedAt:  meta.CreatedAt,
			UpdatedAt:  meta.UpdatedAt,
			LastSentAt: meta.LastSentAt,
			LastStatus: meta.LastStatus,
			LastError:  meta.LastError,
		})
	}
	return results, nil
}

func (s *K8sStore) Update(ctx context.Context, id string, req UpdateWebhookRequest) error {
	metadata, err := s.loadMetadata(ctx)
	if err != nil {
		return err
	}

	meta, ok := metadata[id]
	if !ok {
		return fmt.Errorf("webhook not found: %s", id)
	}

	if req.Name != nil {
		meta.Name = *req.Name
	}
	if req.Type != nil {
		meta.Type = *req.Type
	}
	if req.Events != nil {
		meta.Events = req.Events
	}
	if req.Enabled != nil {
		meta.Enabled = *req.Enabled
	}
	meta.UpdatedAt = time.Now()

	if err := s.saveMetadata(ctx, metadata); err != nil {
		return err
	}

	if req.URL != nil {
		if err := s.saveURL(ctx, id, *req.URL); err != nil {
			return err
		}
	}

	return nil
}

func (s *K8sStore) Delete(ctx context.Context, id string) error {
	metadata, err := s.loadMetadata(ctx)
	if err != nil {
		return err
	}

	if _, ok := metadata[id]; !ok {
		return fmt.Errorf("webhook not found: %s", id)
	}

	delete(metadata, id)
	if err := s.saveMetadata(ctx, metadata); err != nil {
		return err
	}

	return s.deleteURL(ctx, id)
}

func (s *K8sStore) UpdateDeliveryStatus(ctx context.Context, id string, status string, errMsg string) error {
	metadata, err := s.loadMetadata(ctx)
	if err != nil {
		return err
	}

	meta, ok := metadata[id]
	if !ok {
		return nil // Silently ignore missing webhooks during delivery
	}

	now := time.Now()
	meta.LastSentAt = &now
	meta.LastStatus = status
	meta.LastError = errMsg
	meta.UpdatedAt = now

	return s.saveMetadata(ctx, metadata)
}

func (s *K8sStore) Close() error {
	return nil
}
