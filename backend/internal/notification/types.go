package notification

import "time"

// WebhookType identifies the notification service type.
type WebhookType string

const (
	WebhookSlack   WebhookType = "slack"
	WebhookTeams   WebhookType = "teams"
	WebhookDiscord WebhookType = "discord"
	WebhookGeneric WebhookType = "webhook"
)

// EventType identifies the type of event that triggers a notification.
type EventType string

const (
	EventBackupFailed          EventType = "backup_failed"
	EventBackupPartiallyFailed EventType = "backup_partially_failed"
	EventRestoreFailed         EventType = "restore_failed"
	EventBSLUnavailable        EventType = "bsl_unavailable"
)

// WebhookConfig stores the configuration for a webhook endpoint.
type WebhookConfig struct {
	ID        string      `json:"id"`
	Name      string      `json:"name"`
	Type      WebhookType `json:"type"`
	URL       string      `json:"url"`
	Events    []EventType `json:"events"`
	Enabled   bool        `json:"enabled"`
	CreatedAt time.Time   `json:"createdAt"`
	UpdatedAt time.Time   `json:"updatedAt"`

	// Delivery tracking
	LastSentAt *time.Time `json:"lastSentAt,omitempty"`
	LastStatus string     `json:"lastStatus,omitempty"` // "success" or "error"
	LastError  string     `json:"lastError,omitempty"`
}

// CreateWebhookRequest is the payload for creating a webhook.
type CreateWebhookRequest struct {
	Name    string      `json:"name"`
	Type    WebhookType `json:"type"`
	URL     string      `json:"url"`
	Events  []EventType `json:"events"`
	Enabled bool        `json:"enabled"`
}

// UpdateWebhookRequest is the payload for updating a webhook.
type UpdateWebhookRequest struct {
	Name    *string      `json:"name,omitempty"`
	Type    *WebhookType `json:"type,omitempty"`
	URL     *string      `json:"url,omitempty"`
	Events  []EventType  `json:"events,omitempty"`
	Enabled *bool        `json:"enabled,omitempty"`
}

// NotificationEvent is the event dispatched to webhook senders.
type NotificationEvent struct {
	Type        EventType   `json:"event"`
	Title       string      `json:"title"`
	Message     string      `json:"message"`
	ClusterID   string      `json:"clusterId"`
	ClusterName string      `json:"clusterName"`
	Resource    interface{} `json:"resource,omitempty"`
	Timestamp   time.Time   `json:"timestamp"`
}
