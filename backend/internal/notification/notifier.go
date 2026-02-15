package notification

import (
	"context"
	"time"

	"github.com/klinux/velero-dashboard/internal/metrics"
	"go.uber.org/zap"
)

// Sender sends a notification to a webhook URL.
type Sender interface {
	Send(ctx context.Context, url string, event NotificationEvent) error
}

// Manager dispatches notifications to configured webhooks.
type Manager struct {
	store   Store
	senders map[WebhookType]Sender
	logger  *zap.Logger
}

// NewManager creates a notification manager with all registered senders.
func NewManager(store Store, logger *zap.Logger) *Manager {
	m := &Manager{
		store:   store,
		senders: make(map[WebhookType]Sender),
		logger:  logger,
	}

	m.senders[WebhookSlack] = &SlackSender{}
	m.senders[WebhookTeams] = &TeamsSender{}
	m.senders[WebhookDiscord] = &DiscordSender{}
	m.senders[WebhookGeneric] = &GenericWebhookSender{}

	return m
}

// Store returns the underlying store for use by handlers.
func (m *Manager) Store() Store {
	return m.store
}

// Dispatch sends an event to all matching enabled webhooks.
func (m *Manager) Dispatch(ctx context.Context, event NotificationEvent) {
	webhooks, err := m.store.List(ctx)
	if err != nil {
		m.logger.Error("Failed to list webhooks for dispatch", zap.Error(err))
		return
	}

	for _, wh := range webhooks {
		if !wh.Enabled || !containsEvent(wh.Events, event.Type) {
			continue
		}
		go m.send(ctx, wh, event)
	}
}

// SendTest sends a test notification to a specific webhook.
func (m *Manager) SendTest(ctx context.Context, webhookID string) error {
	wh, err := m.store.Get(ctx, webhookID)
	if err != nil {
		return err
	}

	event := NotificationEvent{
		Type:      "test",
		Title:     "Test Notification",
		Message:   "This is a test notification from Velero Dashboard",
		Timestamp: time.Now(),
	}

	sender, ok := m.senders[wh.Type]
	if !ok {
		return nil
	}

	return sender.Send(ctx, wh.URL, event)
}

func (m *Manager) send(ctx context.Context, wh *WebhookConfig, event NotificationEvent) {
	sender, ok := m.senders[wh.Type]
	if !ok {
		m.logger.Error("No sender for webhook type", zap.String("type", string(wh.Type)))
		return
	}

	start := time.Now()
	err := sender.Send(ctx, wh.URL, event)
	duration := time.Since(start).Seconds()

	metrics.WebhookDeliveryDuration.WithLabelValues(string(wh.Type)).Observe(duration)

	status := "success"
	errMsg := ""
	if err != nil {
		status = "error"
		errMsg = err.Error()
		m.logger.Error("Webhook delivery failed",
			zap.String("webhook", wh.Name),
			zap.String("type", string(wh.Type)),
			zap.String("event", string(event.Type)),
			zap.Error(err))
	} else {
		m.logger.Info("Webhook delivered",
			zap.String("webhook", wh.Name),
			zap.String("event", string(event.Type)),
			zap.Duration("duration", time.Duration(duration*float64(time.Second))))
	}

	metrics.WebhookDeliveriesTotal.WithLabelValues(string(wh.Type), status).Inc()
	_ = m.store.UpdateDeliveryStatus(ctx, wh.ID, status, errMsg)
}

func containsEvent(events []EventType, target EventType) bool {
	for _, e := range events {
		if e == target {
			return true
		}
	}
	return false
}
