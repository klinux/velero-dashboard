package handler

import (
	"context"
	"fmt"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/cluster"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"go.uber.org/zap"
)

// CrossClusterHandler handles cross-cluster backup and restore operations.
type CrossClusterHandler struct {
	clusterMgr *cluster.Manager
	logger     *zap.Logger
}

// NewCrossClusterHandler creates a new cross-cluster handler.
func NewCrossClusterHandler(clusterMgr *cluster.Manager, logger *zap.Logger) *CrossClusterHandler {
	return &CrossClusterHandler{clusterMgr: clusterMgr, logger: logger}
}

// SharedBackups returns backups accessible across clusters via shared BSLs.
func (h *CrossClusterHandler) SharedBackups(c *fiber.Ctx) error {
	clients := h.clusterMgr.GetAllClients()
	if len(clients) < 2 {
		return c.JSON([]k8s.CrossClusterBackup{})
	}

	// Get cluster names for display
	clusterNames := h.getClusterNames(c.Context())

	// Step 1: Parallel fetch BSLs from all clusters
	type clusterBSLResult struct {
		clusterID string
		bsls      []k8s.BackupStorageLocationResponse
	}

	var wgBSL sync.WaitGroup
	bslCh := make(chan clusterBSLResult, len(clients))

	for id, client := range clients {
		wgBSL.Add(1)
		go func(cid string, cl *k8s.Client) {
			defer wgBSL.Done()
			bsls, err := cl.ListBackupStorageLocations(c.Context())
			if err != nil {
				h.logger.Warn("Failed to fetch BSLs from cluster", zap.String("cluster", cid), zap.Error(err))
				return
			}
			bslCh <- clusterBSLResult{clusterID: cid, bsls: bsls}
		}(id, client)
	}
	wgBSL.Wait()
	close(bslCh)

	// Step 2: Group BSLs by provider/bucket/prefix to find shared ones
	type bslKey struct {
		provider string
		bucket   string
		prefix   string
	}
	bslGroups := make(map[bslKey][]string)
	for result := range bslCh {
		for _, bsl := range result.bsls {
			key := bslKey{provider: bsl.Provider, bucket: bsl.Bucket, prefix: bsl.Prefix}
			bslGroups[key] = appendUnique(bslGroups[key], result.clusterID)
		}
	}

	// Filter to shared BSLs only (present in 2+ clusters)
	sharedBSLKeys := make(map[bslKey][]string)
	for key, clusters := range bslGroups {
		if len(clusters) >= 2 {
			sharedBSLKeys[key] = clusters
		}
	}

	if len(sharedBSLKeys) == 0 {
		return c.JSON([]k8s.CrossClusterBackup{})
	}

	// Build a set of which BSL names on each cluster are shared
	// Need to re-map: for each cluster, which BSL names correspond to shared keys
	type clusterBSLName struct {
		clusterID string
		bslName   string
	}
	sharedBSLNames := make(map[clusterBSLName]bool)

	// Re-fetch BSLs to match names (we already have them in memory from bslCh — but channel is consumed)
	// More efficient: parallel fetch backups from all clusters and filter by storageLocation
	// Step 3: Fetch backups from all clusters in parallel
	type clusterBackupsResult struct {
		clusterID string
		backups   []k8s.BackupResponse
	}

	var wgBackups sync.WaitGroup
	backupsCh := make(chan clusterBackupsResult, len(clients))

	for id, client := range clients {
		wgBackups.Add(1)
		go func(cid string, cl *k8s.Client) {
			defer wgBackups.Done()
			backups, err := cl.ListBackups(c.Context())
			if err != nil {
				h.logger.Warn("Failed to fetch backups from cluster", zap.String("cluster", cid), zap.Error(err))
				return
			}
			backupsCh <- clusterBackupsResult{clusterID: cid, backups: backups}
		}(id, client)
	}
	wgBackups.Wait()
	close(backupsCh)

	// Also need BSLs again per cluster to map storageLocation name → bslKey
	// Do another parallel fetch (cheap operation)
	var wgBSL2 sync.WaitGroup
	bslCh2 := make(chan clusterBSLResult, len(clients))
	for id, client := range clients {
		wgBSL2.Add(1)
		go func(cid string, cl *k8s.Client) {
			defer wgBSL2.Done()
			bsls, _ := cl.ListBackupStorageLocations(c.Context())
			bslCh2 <- clusterBSLResult{clusterID: cid, bsls: bsls}
		}(id, client)
	}
	wgBSL2.Wait()
	close(bslCh2)

	// Build map: clusterID → bslName → bslKey
	clusterBSLMap := make(map[string]map[string]bslKey)
	for result := range bslCh2 {
		m := make(map[string]bslKey)
		for _, bsl := range result.bsls {
			m[bsl.Name] = bslKey{provider: bsl.Provider, bucket: bsl.Bucket, prefix: bsl.Prefix}
		}
		clusterBSLMap[result.clusterID] = m
	}

	// Identify shared BSL names per cluster
	for clusterID, bslMap := range clusterBSLMap {
		for bslName, key := range bslMap {
			if _, isShared := sharedBSLKeys[key]; isShared {
				sharedBSLNames[clusterBSLName{clusterID: clusterID, bslName: bslName}] = true
			}
		}
	}

	// Step 4: Filter backups to only those stored in shared BSLs
	var results []k8s.CrossClusterBackup
	for result := range backupsCh {
		for _, backup := range result.backups {
			key := clusterBSLName{clusterID: result.clusterID, bslName: backup.StorageLocation}
			if sharedBSLNames[key] && backup.Phase == "Completed" {
				results = append(results, k8s.CrossClusterBackup{
					BackupResponse:    backup,
					SourceClusterID:   result.clusterID,
					SourceClusterName: clusterNames[result.clusterID],
				})
			}
		}
	}

	if results == nil {
		results = []k8s.CrossClusterBackup{}
	}
	return c.JSON(results)
}

// CreateCrossClusterRestore creates a restore on the target cluster from a source cluster backup.
func (h *CrossClusterHandler) CreateCrossClusterRestore(c *fiber.Ctx) error {
	var req k8s.CrossClusterRestoreRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.SourceClusterID == "" || req.TargetClusterID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "sourceClusterId and targetClusterId are required"})
	}
	if req.BackupName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "backupName is required"})
	}
	if req.SourceClusterID == req.TargetClusterID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "source and target clusters must be different"})
	}

	// Validate clusters exist and are connected
	sourceClient, err := h.clusterMgr.GetClient(req.SourceClusterID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "source cluster not found or not connected"})
	}

	targetClient, err := h.clusterMgr.GetClient(req.TargetClusterID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "target cluster not found or not connected"})
	}

	// Verify backup exists on source
	backup, err := sourceClient.GetBackup(c.Context(), req.BackupName)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": fmt.Sprintf("backup %s not found on source cluster", req.BackupName)})
	}

	// Verify shared BSL between source and target
	sourceBSLs, err := sourceClient.ListBackupStorageLocations(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list source BSLs"})
	}

	targetBSLs, err := targetClient.ListBackupStorageLocations(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list target BSLs"})
	}

	// Find the source BSL for this backup
	var sourceBSL *k8s.BackupStorageLocationResponse
	for i, bsl := range sourceBSLs {
		if bsl.Name == backup.StorageLocation {
			sourceBSL = &sourceBSLs[i]
			break
		}
	}
	if sourceBSL == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "backup storage location not found on source cluster"})
	}

	// Check if target has a BSL pointing to the same storage
	hasSharedBSL := false
	for _, bsl := range targetBSLs {
		if bsl.Provider == sourceBSL.Provider && bsl.Bucket == sourceBSL.Bucket && bsl.Prefix == sourceBSL.Prefix {
			hasSharedBSL = true
			break
		}
	}
	if !hasSharedBSL {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "target cluster does not have a BSL pointing to the same storage as the source backup",
		})
	}

	// Create restore on target cluster
	restore, err := targetClient.CreateRestore(c.Context(), req.CreateRestoreRequest)
	if err != nil {
		h.logger.Error("Failed to create cross-cluster restore",
			zap.String("source", req.SourceClusterID),
			zap.String("target", req.TargetClusterID),
			zap.String("backup", req.BackupName),
			zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create restore: " + err.Error()})
	}

	h.logger.Info("Cross-cluster restore created",
		zap.String("source", req.SourceClusterID),
		zap.String("target", req.TargetClusterID),
		zap.String("backup", req.BackupName),
		zap.String("restore", restore.Name))

	return c.Status(fiber.StatusCreated).JSON(restore)
}

func (h *CrossClusterHandler) getClusterNames(ctx context.Context) map[string]string {
	names := make(map[string]string)
	summaries, err := h.clusterMgr.ListClusters(ctx)
	if err != nil {
		return names
	}
	for _, s := range summaries {
		names[s.ID] = s.Name
	}
	return names
}

func appendUnique(slice []string, item string) []string {
	for _, s := range slice {
		if s == item {
			return slice
		}
	}
	return append(slice, item)
}
