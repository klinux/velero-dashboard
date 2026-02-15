package handler

import (
	"github.com/klinux/velero-dashboard/internal/k8s"
	"github.com/klinux/velero-dashboard/internal/ws"
	"go.uber.org/zap"
)

// Handlers aggregates all HTTP handler groups.
type Handlers struct {
	Backup    *BackupHandler
	Restore   *RestoreHandler
	Schedule  *ScheduleHandler
	Settings  *SettingsHandler
	Dashboard *DashboardHandler
	WS        *WSHandler
}

func NewHandlers(client *k8s.Client, hub *ws.Hub, logger *zap.Logger) *Handlers {
	return &Handlers{
		Backup:    NewBackupHandler(client, logger),
		Restore:   NewRestoreHandler(client, logger),
		Schedule:  NewScheduleHandler(client, logger),
		Settings:  NewSettingsHandler(client, logger),
		Dashboard: NewDashboardHandler(client, logger),
		WS:        NewWSHandler(hub, logger),
	}
}
