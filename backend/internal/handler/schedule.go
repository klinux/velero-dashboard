package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/cluster"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"go.uber.org/zap"
)

type ScheduleHandler struct {
	clusterMgr *cluster.Manager
	logger     *zap.Logger
}

func NewScheduleHandler(clusterMgr *cluster.Manager, logger *zap.Logger) *ScheduleHandler {
	return &ScheduleHandler{clusterMgr: clusterMgr, logger: logger}
}

func (h *ScheduleHandler) getClient(c *fiber.Ctx) (*k8s.Client, error) {
	clusterID := c.Query("cluster", "")
	if clusterID != "" {
		return h.clusterMgr.GetClient(clusterID)
	}
	return h.clusterMgr.GetDefaultClient(c.Context())
}

func (h *ScheduleHandler) List(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	schedules, err := client.ListSchedules(c.Context())
	if err != nil {
		h.logger.Error("Failed to list schedules", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(schedules)
}

func (h *ScheduleHandler) Get(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	name := c.Params("name")
	schedule, err := client.GetSchedule(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to get schedule", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(schedule)
}

func (h *ScheduleHandler) Create(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	var req k8s.CreateScheduleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Name == "" || req.Schedule == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name and schedule are required"})
	}

	schedule, err := client.CreateSchedule(c.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create schedule", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(schedule)
}

func (h *ScheduleHandler) TogglePause(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	name := c.Params("name")
	schedule, err := client.ToggleSchedulePause(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to toggle schedule pause", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(schedule)
}

func (h *ScheduleHandler) Delete(c *fiber.Ctx) error {
	client, err := h.getClient(c)
	if err != nil {
		h.logger.Error("Failed to get cluster client", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cluster not found or not connected",
		})
	}

	name := c.Params("name")
	if err := client.DeleteSchedule(c.Context(), name); err != nil {
		h.logger.Error("Failed to delete schedule", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "schedule deleted"})
}
