package handler

import (
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/cluster"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"go.uber.org/zap"
)

type DashboardHandler struct {
	clusterMgr *cluster.Manager
	logger     *zap.Logger
}

func NewDashboardHandler(clusterMgr *cluster.Manager, logger *zap.Logger) *DashboardHandler {
	return &DashboardHandler{clusterMgr: clusterMgr, logger: logger}
}

func (h *DashboardHandler) getClient(c *fiber.Ctx) (*k8s.Client, error) {
	clusterID := c.Query("cluster", "")
	if clusterID != "" {
		return h.clusterMgr.GetClient(clusterID)
	}
	return h.clusterMgr.GetDefaultClient(c.Context())
}

func (h *DashboardHandler) Stats(c *fiber.Ctx) error {
	// When cluster=all, aggregate stats from all connected clusters
	if c.Query("cluster") == "all" {
		return h.aggregatedStats(c)
	}

	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	stats, err := client.GetDashboardStats(c.Context())
	if err != nil {
		h.logger.Error("Failed to get dashboard stats", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(stats)
}

func (h *DashboardHandler) aggregatedStats(c *fiber.Ctx) error {
	clients := h.clusterMgr.GetAllClients()
	if len(clients) == 0 {
		return c.JSON(&k8s.DashboardStats{})
	}

	type result struct {
		stats *k8s.DashboardStats
		err   error
	}

	results := make(chan result, len(clients))
	var wg sync.WaitGroup

	for id, client := range clients {
		wg.Add(1)
		go func(clusterID string, cl *k8s.Client) {
			defer wg.Done()
			stats, err := cl.GetDashboardStats(c.Context())
			if err != nil {
				h.logger.Warn("Failed to get stats from cluster",
					zap.String("cluster", clusterID),
					zap.Error(err))
				results <- result{err: err}
				return
			}
			results <- result{stats: stats}
		}(id, client)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	aggregated := &k8s.DashboardStats{}
	for r := range results {
		if r.err != nil || r.stats == nil {
			continue
		}
		aggregated.TotalBackups += r.stats.TotalBackups
		aggregated.CompletedBackups += r.stats.CompletedBackups
		aggregated.FailedBackups += r.stats.FailedBackups
		aggregated.TotalRestores += r.stats.TotalRestores
		aggregated.TotalSchedules += r.stats.TotalSchedules
		aggregated.ActiveSchedules += r.stats.ActiveSchedules
		aggregated.StorageLocations += r.stats.StorageLocations
		aggregated.HealthyLocations += r.stats.HealthyLocations
	}

	return c.JSON(aggregated)
}
