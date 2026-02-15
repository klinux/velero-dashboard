package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"go.uber.org/zap"
)

type BackupHandler struct {
	client *k8s.Client
	logger *zap.Logger
}

func NewBackupHandler(client *k8s.Client, logger *zap.Logger) *BackupHandler {
	return &BackupHandler{client: client, logger: logger}
}

func (h *BackupHandler) List(c *fiber.Ctx) error {
	backups, err := h.client.ListBackups(c.Context())
	if err != nil {
		h.logger.Error("Failed to list backups", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(backups)
}

func (h *BackupHandler) Get(c *fiber.Ctx) error {
	name := c.Params("name")
	backup, err := h.client.GetBackup(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to get backup", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(backup)
}

func (h *BackupHandler) Create(c *fiber.Ctx) error {
	var req k8s.CreateBackupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	backup, err := h.client.CreateBackup(c.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create backup", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(backup)
}

func (h *BackupHandler) Delete(c *fiber.Ctx) error {
	name := c.Params("name")
	if err := h.client.DeleteBackup(c.Context(), name); err != nil {
		h.logger.Error("Failed to delete backup", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "delete request created"})
}

func (h *BackupHandler) Logs(c *fiber.Ctx) error {
	name := c.Params("name")
	logs, err := h.client.GetBackupLogs(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to get backup logs", zap.String("name", name), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendString(logs)
}

func (h *BackupHandler) Compare(c *fiber.Ctx) error {
	backup1 := c.Query("backup1")
	backup2 := c.Query("backup2")

	if backup1 == "" || backup2 == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "backup1 and backup2 query parameters are required"})
	}

	comparison, err := h.client.CompareBackups(c.Context(), backup1, backup2)
	if err != nil {
		h.logger.Error("Failed to compare backups", zap.String("backup1", backup1), zap.String("backup2", backup2), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(comparison)
}
