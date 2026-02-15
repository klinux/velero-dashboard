package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"go.uber.org/zap"
)

type RestoreHandler struct {
	client *k8s.Client
	logger *zap.Logger
}

func NewRestoreHandler(client *k8s.Client, logger *zap.Logger) *RestoreHandler {
	return &RestoreHandler{client: client, logger: logger}
}

func (h *RestoreHandler) List(c *fiber.Ctx) error {
	restores, err := h.client.ListRestores(c.Context())
	if err != nil {
		h.logger.Error("Failed to list restores", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(restores)
}

func (h *RestoreHandler) Get(c *fiber.Ctx) error {
	name := c.Params("name")
	restore, err := h.client.GetRestore(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to get restore", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(restore)
}

func (h *RestoreHandler) Create(c *fiber.Ctx) error {
	var req k8s.CreateRestoreRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.BackupName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "backupName is required"})
	}

	restore, err := h.client.CreateRestore(c.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create restore", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(restore)
}
