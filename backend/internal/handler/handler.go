package handler

import (
	"github.com/klinux/velero-dashboard/internal/cluster"
	"github.com/klinux/velero-dashboard/internal/notification"
	"github.com/klinux/velero-dashboard/internal/ws"
	"go.uber.org/zap"
)

// Handlers aggregates all HTTP handler groups.
type Handlers struct {
	Backup       *BackupHandler
	Restore      *RestoreHandler
	Schedule     *ScheduleHandler
	Settings     *SettingsHandler
	Dashboard    *DashboardHandler
	Cluster      *ClusterHandler
	WS           *WSHandler
	Notification *NotificationHandler
	CrossCluster *CrossClusterHandler
}

func NewHandlers(clusterMgr *cluster.Manager, hub *ws.Hub, notifMgr *notification.Manager, logger *zap.Logger) *Handlers {
	return &Handlers{
		Backup:       NewBackupHandler(clusterMgr, logger),
		Restore:      NewRestoreHandler(clusterMgr, logger),
		Schedule:     NewScheduleHandler(clusterMgr, logger),
		Settings:     NewSettingsHandler(clusterMgr, logger),
		Dashboard:    NewDashboardHandler(clusterMgr, logger),
		Cluster:      NewClusterHandler(clusterMgr, logger),
		WS:           NewWSHandler(hub, logger),
		Notification: NewNotificationHandler(notifMgr, logger),
		CrossCluster: NewCrossClusterHandler(clusterMgr, logger),
	}
}
