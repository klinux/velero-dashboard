package handler

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/k8s"
	"go.uber.org/zap"
)

type SettingsHandler struct {
	client *k8s.Client
	logger *zap.Logger
}

func NewSettingsHandler(client *k8s.Client, logger *zap.Logger) *SettingsHandler {
	return &SettingsHandler{client: client, logger: logger}
}

func (h *SettingsHandler) BackupLocations(c *fiber.Ctx) error {
	locations, err := h.client.ListBackupStorageLocations(c.Context())
	if err != nil {
		h.logger.Error("Failed to list backup storage locations", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(locations)
}

func (h *SettingsHandler) CreateBackupLocation(c *fiber.Ctx) error {
	var req k8s.CreateBackupStorageLocationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Basic validation
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name is required"})
	}
	if req.Provider == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Provider is required"})
	}
	if req.Bucket == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Bucket is required"})
	}

	// Provider-specific validation
	switch req.Provider {
	case "aws", "velero.io/aws":
		if req.Region == "" && req.S3Url == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Region or S3 URL is required for AWS provider"})
		}
	case "gcp", "velero.io/gcp":
		// GCP can work without region, but it's recommended
	case "azure", "velero.io/azure":
		if req.StorageAccount == "" || req.ResourceGroup == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Storage account and resource group are required for Azure provider"})
		}
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported provider. Use: aws, gcp, azure, or velero.io/aws"})
	}

	location, err := h.client.CreateBackupStorageLocation(c.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create backup storage location", zap.Error(err), zap.String("name", req.Name))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(location)
}

func (h *SettingsHandler) DeleteBackupLocation(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name parameter is required"})
	}

	err := h.client.DeleteBackupStorageLocation(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to delete backup storage location", zap.Error(err), zap.String("name", name))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": fmt.Sprintf("Backup storage location %s deleted", name)})
}

func (h *SettingsHandler) UpdateBackupLocation(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name parameter is required"})
	}

	var req k8s.UpdateBackupStorageLocationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate access mode if provided
	if req.AccessMode != "" && req.AccessMode != "ReadWrite" && req.AccessMode != "ReadOnly" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "AccessMode must be ReadWrite or ReadOnly"})
	}

	location, err := h.client.UpdateBackupStorageLocation(c.Context(), name, req)
	if err != nil {
		h.logger.Error("Failed to update backup storage location", zap.Error(err), zap.String("name", name))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(location)
}

func (h *SettingsHandler) SnapshotLocations(c *fiber.Ctx) error {
	locations, err := h.client.ListVolumeSnapshotLocations(c.Context())
	if err != nil {
		h.logger.Error("Failed to list volume snapshot locations", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(locations)
}

func (h *SettingsHandler) CreateSnapshotLocation(c *fiber.Ctx) error {
	var req k8s.CreateVolumeSnapshotLocationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Basic validation
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name is required"})
	}
	if req.Provider == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Provider is required"})
	}

	// Provider-specific validation
	switch req.Provider {
	case "aws", "velero.io/aws":
		if req.Region == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Region is required for AWS provider"})
		}
	case "gcp", "velero.io/gcp":
		// GCP doesn't require specific fields
	case "azure", "velero.io/azure":
		// Azure fields are optional for VSL
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported provider. Use: aws, gcp, or azure"})
	}

	location, err := h.client.CreateVolumeSnapshotLocation(c.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create volume snapshot location", zap.Error(err), zap.String("name", req.Name))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(location)
}

func (h *SettingsHandler) DeleteSnapshotLocation(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name parameter is required"})
	}

	err := h.client.DeleteVolumeSnapshotLocation(c.Context(), name)
	if err != nil {
		h.logger.Error("Failed to delete volume snapshot location", zap.Error(err), zap.String("name", name))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": fmt.Sprintf("Volume snapshot location %s deleted", name)})
}

func (h *SettingsHandler) UpdateSnapshotLocation(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name parameter is required"})
	}

	var req k8s.UpdateVolumeSnapshotLocationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	location, err := h.client.UpdateVolumeSnapshotLocation(c.Context(), name, req)
	if err != nil {
		h.logger.Error("Failed to update volume snapshot location", zap.Error(err), zap.String("name", name))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(location)
}

func (h *SettingsHandler) ServerInfo(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"namespace": h.client.Namespace(),
		"version":   "dashboard-v1.0.0",
	})
}
