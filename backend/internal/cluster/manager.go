package cluster

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/klinux/velero-dashboard/internal/k8s"
	"github.com/klinux/velero-dashboard/internal/ws"
	"go.uber.org/zap"
)

// ManagedCluster wraps a cluster with its client and informer
type ManagedCluster struct {
	Cluster     *Cluster
	Client      *k8s.Client
	InformerMgr *k8s.InformerManager
	CancelFunc  context.CancelFunc
}

// Manager manages all cluster connections and informers
type Manager struct {
	store      Store
	clusters   map[string]*ManagedCluster
	mu         sync.RWMutex
	hub        *ws.Hub
	notifier   k8s.EventNotifier
	logger     *zap.Logger
	healthTick *time.Ticker
}

// NewManager creates a cluster manager
func NewManager(store Store, hub *ws.Hub, logger *zap.Logger) *Manager {
	return &Manager{
		store:    store,
		clusters: make(map[string]*ManagedCluster),
		hub:      hub,
		logger:   logger,
	}
}

// SetNotifier sets the event notifier for dispatching notifications from informers.
func (m *Manager) SetNotifier(n k8s.EventNotifier) {
	m.notifier = n
}

// Start initializes all clusters from store and starts health checks
func (m *Manager) Start(ctx context.Context) error {
	// Load all clusters from store
	summaries, err := m.store.List(ctx)
	if err != nil {
		return fmt.Errorf("failed to load clusters: %w", err)
	}

	m.logger.Info("Loading clusters from store", zap.Int("count", len(summaries)))

	// Connect to each cluster with staggered startup (100ms delay)
	for i, summary := range summaries {
		cluster, err := m.store.Get(ctx, summary.ID)
		if err != nil {
			m.logger.Error("Failed to load cluster details",
				zap.String("id", summary.ID),
				zap.String("name", summary.Name),
				zap.Error(err))
			continue
		}

		// Stagger connections to avoid connection storms
		if i > 0 {
			time.Sleep(100 * time.Millisecond)
		}

		if err := m.AddCluster(ctx, cluster); err != nil {
			m.logger.Error("Failed to connect to cluster",
				zap.String("name", cluster.Name),
				zap.Error(err))
			// Continue with other clusters even if one fails
		}
	}

	// Start health check routine
	m.healthTick = time.NewTicker(30 * time.Second)
	go m.healthCheckLoop(ctx)

	m.logger.Info("Cluster manager started",
		zap.Int("connected", len(m.clusters)),
		zap.Int("total", len(summaries)))

	return nil
}

// AddCluster adds and connects to a new cluster
func (m *Manager) AddCluster(ctx context.Context, cluster *Cluster) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if already connected
	if _, exists := m.clusters[cluster.ID]; exists {
		return fmt.Errorf("cluster already connected")
	}

	// Create K8s client from kubeconfig
	client, err := k8s.NewClientFromKubeconfig(
		cluster.KubeconfigRaw,
		cluster.Namespace,
		m.logger,
	)
	if err != nil {
		_ = m.store.UpdateStatus(ctx, cluster.ID, "error", err.Error())
		return fmt.Errorf("failed to create client: %w", err)
	}

	// Test connection
	testCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := client.TestConnection(testCtx); err != nil {
		_ = m.store.UpdateStatus(ctx, cluster.ID, "error", err.Error())
		return fmt.Errorf("connection test failed: %w", err)
	}

	// Start informers for this cluster
	clusterCtx, clusterCancel := context.WithCancel(ctx)
	informerMgr := k8s.NewInformerManager(client, m.hub, cluster.ID, cluster.Name, m.logger)
	if m.notifier != nil {
		informerMgr.SetNotifier(m.notifier)
	}
	go informerMgr.Start(clusterCtx)

	m.clusters[cluster.ID] = &ManagedCluster{
		Cluster:     cluster,
		Client:      client,
		InformerMgr: informerMgr,
		CancelFunc:  clusterCancel,
	}

	_ = m.store.UpdateStatus(ctx, cluster.ID, "connected", "")
	m.logger.Info("Cluster connected",
		zap.String("id", cluster.ID),
		zap.String("name", cluster.Name),
		zap.String("namespace", cluster.Namespace))

	return nil
}

// RemoveCluster disconnects and removes a cluster
func (m *Manager) RemoveCluster(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	mc, exists := m.clusters[id]
	if !exists {
		return fmt.Errorf("cluster not found or not connected")
	}

	// Stop informers
	mc.CancelFunc()

	// Remove from memory
	delete(m.clusters, id)

	m.logger.Info("Cluster removed",
		zap.String("id", id),
		zap.String("name", mc.Cluster.Name))

	return nil
}

// GetClient returns the K8s client for a cluster
func (m *Manager) GetClient(id string) (*k8s.Client, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	mc, exists := m.clusters[id]
	if !exists {
		return nil, fmt.Errorf("cluster not found or not connected: %s", id)
	}

	return mc.Client, nil
}

// GetDefaultClient returns the default cluster's client
func (m *Manager) GetDefaultClient(ctx context.Context) (*k8s.Client, error) {
	defaultCluster, err := m.store.GetDefault(ctx)
	if err != nil {
		return nil, fmt.Errorf("no default cluster configured: %w", err)
	}
	return m.GetClient(defaultCluster.ID)
}

// ListClusters returns all cluster summaries
func (m *Manager) ListClusters(ctx context.Context) ([]*ClusterSummary, error) {
	return m.store.List(ctx)
}

// GetAllClients returns all connected cluster clients with their IDs
func (m *Manager) GetAllClients() map[string]*k8s.Client {
	m.mu.RLock()
	defer m.mu.RUnlock()

	clients := make(map[string]*k8s.Client, len(m.clusters))
	for id, mc := range m.clusters {
		clients[id] = mc.Client
	}
	return clients
}

// GetStore returns the underlying store (needed by handler)
func (m *Manager) GetStore() Store {
	return m.store
}

// healthCheckLoop periodically checks cluster connectivity
func (m *Manager) healthCheckLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			m.healthTick.Stop()
			return
		case <-m.healthTick.C:
			m.performHealthChecks(ctx)
		}
	}
}

func (m *Manager) performHealthChecks(ctx context.Context) {
	m.mu.RLock()
	clusterIDs := make([]string, 0, len(m.clusters))
	for id := range m.clusters {
		clusterIDs = append(clusterIDs, id)
	}
	m.mu.RUnlock()

	for _, id := range clusterIDs {
		go m.healthCheckCluster(ctx, id)
	}
}

func (m *Manager) healthCheckCluster(ctx context.Context, clusterID string) {
	m.mu.RLock()
	mc, exists := m.clusters[clusterID]
	m.mu.RUnlock()

	if !exists {
		return
	}

	checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := mc.Client.TestConnection(checkCtx); err != nil {
		m.logger.Warn("Health check failed",
			zap.String("cluster", clusterID),
			zap.String("name", mc.Cluster.Name),
			zap.Error(err))
		_ = m.store.UpdateStatus(ctx, clusterID, "error", err.Error())
	} else {
		_ = m.store.UpdateStatus(ctx, clusterID, "connected", "")
	}
}

// StartReconciliation starts watching for external cluster Secret changes (GitOps/declarative mode).
// Only active when using Kubernetes storage backend.
func (m *Manager) StartReconciliation(ctx context.Context) error {
	k8sStore, ok := m.store.(*K8sStore)
	if !ok {
		m.logger.Info("Reconciliation not available (not using Kubernetes storage)")
		return nil
	}

	m.logger.Info("Starting cluster reconciliation (watching for external Secret changes)")
	return k8sStore.WatchSecrets(ctx, func() {
		m.reconcile(ctx)
	})
}

// reconcile syncs in-memory cluster connections with the store.
// Adds new clusters, removes deleted ones.
func (m *Manager) reconcile(ctx context.Context) {
	summaries, err := m.store.List(ctx)
	if err != nil {
		m.logger.Error("Reconciliation failed: could not list clusters", zap.Error(err))
		return
	}

	// Build set of store cluster IDs
	storeIDs := make(map[string]bool, len(summaries))
	for _, s := range summaries {
		storeIDs[s.ID] = true
	}

	// Get current in-memory cluster IDs
	m.mu.RLock()
	memoryIDs := make(map[string]bool, len(m.clusters))
	for id := range m.clusters {
		memoryIDs[id] = true
	}
	m.mu.RUnlock()

	// Add new clusters (in store but not in memory)
	for _, summary := range summaries {
		if memoryIDs[summary.ID] {
			continue
		}

		cluster, err := m.store.Get(ctx, summary.ID)
		if err != nil {
			m.logger.Error("Reconciliation: failed to get cluster",
				zap.String("id", summary.ID),
				zap.Error(err))
			continue
		}

		m.logger.Info("Reconciliation: adding new cluster",
			zap.String("id", cluster.ID),
			zap.String("name", cluster.Name))

		if err := m.AddCluster(ctx, cluster); err != nil {
			m.logger.Error("Reconciliation: failed to connect cluster",
				zap.String("id", cluster.ID),
				zap.String("name", cluster.Name),
				zap.Error(err))
		}
	}

	// Remove clusters (in memory but not in store)
	for id := range memoryIDs {
		if storeIDs[id] {
			continue
		}

		m.logger.Info("Reconciliation: removing cluster",
			zap.String("id", id))

		if err := m.RemoveCluster(id); err != nil {
			m.logger.Error("Reconciliation: failed to remove cluster",
				zap.String("id", id),
				zap.Error(err))
		}
	}
}

// Shutdown gracefully stops all clusters
func (m *Manager) Shutdown() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logger.Info("Shutting down cluster manager", zap.Int("clusters", len(m.clusters)))

	if m.healthTick != nil {
		m.healthTick.Stop()
	}

	for id, mc := range m.clusters {
		mc.CancelFunc()
		m.logger.Info("Stopped cluster", zap.String("id", id), zap.String("name", mc.Cluster.Name))
	}

	m.clusters = make(map[string]*ManagedCluster)

	if err := m.store.Close(); err != nil {
		m.logger.Error("Failed to close store", zap.Error(err))
	}
}
