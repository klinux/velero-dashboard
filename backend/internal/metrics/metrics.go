package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// ClustersConnected tracks the number of connected clusters.
	ClustersConnected = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "velero_dashboard_clusters_connected",
		Help: "Number of currently connected clusters",
	})

	// ClustersTotal tracks the total number of configured clusters.
	ClustersTotal = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "velero_dashboard_clusters_total",
		Help: "Total number of configured clusters",
	})

	// HTTPRequestsTotal counts HTTP requests by method, path, and status.
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "velero_dashboard_http_requests_total",
		Help: "Total HTTP requests",
	}, []string{"method", "path", "status"})

	// HTTPRequestDuration tracks request latency.
	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "velero_dashboard_http_request_duration_seconds",
		Help:    "HTTP request duration in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "path"})

	// WebSocketClients tracks active WebSocket connections.
	WebSocketClients = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "velero_dashboard_websocket_clients",
		Help: "Number of active WebSocket connections",
	})

	// BackupEvents counts backup-related events by action.
	BackupEvents = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "velero_dashboard_backup_events_total",
		Help: "Total backup events observed via informers",
	}, []string{"cluster", "action"})

	// HealthCheckFailures counts cluster health check failures.
	HealthCheckFailures = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "velero_dashboard_health_check_failures_total",
		Help: "Total cluster health check failures",
	}, []string{"cluster"})

	// WebhookDeliveriesTotal counts webhook delivery attempts.
	WebhookDeliveriesTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "velero_dashboard_webhook_deliveries_total",
		Help: "Total webhook delivery attempts",
	}, []string{"type", "status"})

	// WebhookDeliveryDuration tracks webhook delivery latency.
	WebhookDeliveryDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "velero_dashboard_webhook_delivery_duration_seconds",
		Help:    "Webhook delivery duration in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"type"})
)
