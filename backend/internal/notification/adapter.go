package notification

import (
	"context"
	"time"

	"github.com/klinux/velero-dashboard/internal/k8s"
)

// Adapter bridges k8s.EventNotifier interface with the notification Manager.
type Adapter struct {
	mgr *Manager
}

// NewAdapter creates a new notification adapter.
func NewAdapter(mgr *Manager) *Adapter {
	return &Adapter{mgr: mgr}
}

// Dispatch implements k8s.EventNotifier.
func (a *Adapter) Dispatch(_ context.Context, payload k8s.NotificationPayload) {
	event := NotificationEvent{
		Type:        EventType(payload.EventType),
		Title:       payload.Title,
		Message:     payload.Message,
		ClusterID:   payload.ClusterID,
		ClusterName: payload.ClusterName,
		Resource:    payload.Resource,
		Timestamp:   time.Now(),
	}
	a.mgr.Dispatch(context.Background(), event)
}
