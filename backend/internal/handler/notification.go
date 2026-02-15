package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/klinux/velero-dashboard/internal/notification"
	"go.uber.org/zap"
)

// NotificationHandler handles webhook CRUD operations.
type NotificationHandler struct {
	notifMgr *notification.Manager
	logger   *zap.Logger
}

// NewNotificationHandler creates a new notification handler.
func NewNotificationHandler(notifMgr *notification.Manager, logger *zap.Logger) *NotificationHandler {
	return &NotificationHandler{notifMgr: notifMgr, logger: logger}
}

// ListWebhooks returns all configured webhooks.
func (h *NotificationHandler) ListWebhooks(c *fiber.Ctx) error {
	webhooks, err := h.notifMgr.Store().List(c.Context())
	if err != nil {
		h.logger.Error("Failed to list webhooks", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list webhooks"})
	}

	if webhooks == nil {
		webhooks = []*notification.WebhookConfig{}
	}
	return c.JSON(webhooks)
}

// CreateWebhook creates a new webhook configuration.
func (h *NotificationHandler) CreateWebhook(c *fiber.Ctx) error {
	var req notification.CreateWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}
	if req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "url is required"})
	}
	if req.Type == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "type is required"})
	}
	if len(req.Events) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "at least one event is required"})
	}

	wh, err := h.notifMgr.Store().Create(c.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create webhook", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create webhook"})
	}

	return c.Status(fiber.StatusCreated).JSON(wh)
}

// UpdateWebhook updates an existing webhook configuration.
func (h *NotificationHandler) UpdateWebhook(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	var req notification.UpdateWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := h.notifMgr.Store().Update(c.Context(), id, req); err != nil {
		h.logger.Error("Failed to update webhook", zap.String("id", id), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update webhook"})
	}

	return c.JSON(fiber.Map{"message": "webhook updated"})
}

// DeleteWebhook deletes a webhook configuration.
func (h *NotificationHandler) DeleteWebhook(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	if err := h.notifMgr.Store().Delete(c.Context(), id); err != nil {
		h.logger.Error("Failed to delete webhook", zap.String("id", id), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete webhook"})
	}

	return c.JSON(fiber.Map{"message": "webhook deleted"})
}

// TestWebhook sends a test notification to a specific webhook.
func (h *NotificationHandler) TestWebhook(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	if err := h.notifMgr.SendTest(c.Context(), id); err != nil {
		h.logger.Error("Failed to send test notification", zap.String("id", id), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to send test notification: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "test notification sent"})
}
