package handler

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/cluster"
	"go.uber.org/zap"
)

type ClusterHandler struct {
	manager *cluster.Manager
	logger  *zap.Logger
}

func NewClusterHandler(manager *cluster.Manager, logger *zap.Logger) *ClusterHandler {
	return &ClusterHandler{
		manager: manager,
		logger:  logger,
	}
}

// List returns all clusters (without kubeconfig)
// GET /api/clusters
func (h *ClusterHandler) List(c *fiber.Ctx) error {
	clusters, err := h.manager.ListClusters(c.Context())
	if err != nil {
		h.logger.Error("Failed to list clusters", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to list clusters",
		})
	}
	return c.JSON(clusters)
}

// Get returns a single cluster (without kubeconfig)
// GET /api/clusters/:id
func (h *ClusterHandler) Get(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster ID is required",
		})
	}

	clusterObj, err := h.manager.GetStore().Get(c.Context(), id)
	if err != nil {
		h.logger.Error("Failed to get cluster",
			zap.String("id", id),
			zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Cluster not found",
		})
	}

	// Convert to summary (no kubeconfig)
	return c.JSON(clusterObj.ToSummary())
}

// Create adds a new cluster
// POST /api/clusters
func (h *ClusterHandler) Create(c *fiber.Ctx) error {
	var req cluster.CreateClusterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate required fields
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster name is required",
		})
	}
	if req.Namespace == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Namespace is required",
		})
	}

	// Determine auth mode and validate accordingly
	hasKubeconfig := req.Kubeconfig != ""
	hasTokenAuth := req.APIServer != "" && req.Token != ""

	if !hasKubeconfig && !hasTokenAuth {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Either kubeconfig or (apiServer + token) is required",
		})
	}

	// If token-based auth, convert to kubeconfig
	if hasTokenAuth && !hasKubeconfig {
		req.Kubeconfig = cluster.TokenToKubeconfig(
			req.Name,
			req.APIServer,
			req.Token,
			req.CACert,
			req.InsecureSkipTLS,
		)
		h.logger.Info("Converted token-based auth to kubeconfig",
			zap.String("name", req.Name),
			zap.String("apiServer", req.APIServer))
	}

	// Store cluster
	newCluster, err := h.manager.GetStore().Create(c.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create cluster",
			zap.String("name", req.Name),
			zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	h.logger.Info("Cluster created",
		zap.String("id", newCluster.ID),
		zap.String("name", newCluster.Name))

	// Connect to cluster (async - don't block response)
	go func() {
		// Use a new context for the async operation
		ctx := context.Background()
		if err := h.manager.AddCluster(ctx, newCluster); err != nil {
			h.logger.Error("Failed to connect to cluster",
				zap.String("id", newCluster.ID),
				zap.String("name", newCluster.Name),
				zap.Error(err))
		}
	}()

	return c.Status(fiber.StatusCreated).JSON(newCluster.ToSummary())
}

// Update modifies a cluster
// PATCH /api/clusters/:id
func (h *ClusterHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster ID is required",
		})
	}

	var req cluster.UpdateClusterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Update in store
	if err := h.manager.GetStore().Update(c.Context(), id, req); err != nil {
		h.logger.Error("Failed to update cluster",
			zap.String("id", id),
			zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	h.logger.Info("Cluster updated", zap.String("id", id))

	// If kubeconfig changed, reconnect
	if req.Kubeconfig != nil {
		go func() {
			// Use a new context for the async operation
			ctx := context.Background()

			// Remove old connection
			_ = h.manager.RemoveCluster(id)

			// Reconnect with new config
			updatedCluster, err := h.manager.GetStore().Get(ctx, id)
			if err == nil {
				_ = h.manager.AddCluster(ctx, updatedCluster)
			}
		}()
	}

	return c.JSON(fiber.Map{"message": "Cluster updated successfully"})
}

// Delete removes a cluster
// DELETE /api/clusters/:id
func (h *ClusterHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster ID is required",
		})
	}

	// Remove from manager (stops informers)
	if err := h.manager.RemoveCluster(id); err != nil {
		h.logger.Warn("Failed to remove cluster from manager",
			zap.String("id", id),
			zap.Error(err))
	}

	// Delete from store
	if err := h.manager.GetStore().Delete(c.Context(), id); err != nil {
		h.logger.Error("Failed to delete cluster",
			zap.String("id", id),
			zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete cluster",
		})
	}

	h.logger.Info("Cluster deleted", zap.String("id", id))

	return c.JSON(fiber.Map{"message": "Cluster deleted successfully"})
}
