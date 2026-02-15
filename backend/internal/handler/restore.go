package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/cluster"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"go.uber.org/zap"
)

type RestoreHandler struct {
	clusterMgr *cluster.Manager
	logger     *zap.Logger
}

func NewRestoreHandler(clusterMgr *cluster.Manager, logger *zap.Logger) *RestoreHandler {
	return &RestoreHandler{clusterMgr: clusterMgr, logger: logger}
}

func (h *RestoreHandler) getClient(c *fiber.Ctx) (*k8s.Client, error) {
	clusterID := c.Query("cluster", "")
	if clusterID != "" {
		return h.clusterMgr.GetClient(clusterID)
	}
	return h.clusterMgr.GetDefaultClient(c.Context())
}

func (h *RestoreHandler) List(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	restores, err := client.ListRestores(c.Context())
	if err != nil {
		h.logger.Error("Failed to list restores", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(restores)
}

func (h *RestoreHandler) Get(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	name := c.Params("name")
	restore, err := client.GetRestore(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to get restore", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(restore)
}

func (h *RestoreHandler) Create(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	var req k8s.CreateRestoreRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.BackupName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "backupName is required"})
	}

	restore, err := client.CreateRestore(c.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create restore", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(restore)
}

func (h *RestoreHandler) Delete(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	name := c.Params("name")
	if err := client.DeleteRestore(c.Context(), name); err != nil {
		h.logger.Error("Failed to delete restore", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "restore deleted"})
}

func (h *RestoreHandler) Logs(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	name := c.Params("name")
	logs, err := client.GetRestoreLogs(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to get restore logs", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendString(logs)
}
