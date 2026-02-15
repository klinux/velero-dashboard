package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"go.uber.org/zap"
)

type DashboardHandler struct {
	client *k8s.Client
	logger *zap.Logger
}

func NewDashboardHandler(client *k8s.Client, logger *zap.Logger) *DashboardHandler {
	return &DashboardHandler{client: client, logger: logger}
}

func (h *DashboardHandler) Stats(c *fiber.Ctx) error {
	stats, err := h.client.GetDashboardStats(c.Context())
	if err != nil {
		h.logger.Error("Failed to get dashboard stats", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(stats)
}
