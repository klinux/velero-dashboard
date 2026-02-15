package k8s

import (
	"context"
	"fmt"
	"time"

	"github.com/klinux/velero-dashboard/internal/ws"
	"go.uber.org/zap"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"
)

// EventNotifier is an interface for dispatching notification events.
// This decouples the informer package from the notification package.
type EventNotifier interface {
	Dispatch(ctx context.Context, event NotificationPayload)
}

// NotificationPayload carries the data needed for a notification dispatch.
type NotificationPayload struct {
	EventType   string // e.g. "backup_failed", "restore_failed", "bsl_unavailable"
	Title       string
	Message     string
	ClusterID   string
	ClusterName string
	Resource    interface{}
}

// InformerManager runs informers for Velero CRDs and broadcasts changes via WebSocket.
type InformerManager struct {
	client      *Client
	hub         *ws.Hub
	notifier    EventNotifier
	clusterID   string
	clusterName string
	logger      *zap.Logger
}

func NewInformerManager(client *Client, hub *ws.Hub, clusterID string, clusterName string, logger *zap.Logger) *InformerManager {
	return &InformerManager{
		client:      client,
		hub:         hub,
		clusterID:   clusterID,
		clusterName: clusterName,
		logger:      logger,
	}
}

// SetNotifier sets the notification dispatcher (optional).
func (im *InformerManager) SetNotifier(n EventNotifier) {
	im.notifier = n
}

// Start begins watching all Velero resources. Blocks until ctx is cancelled.
func (im *InformerManager) Start(ctx context.Context) {
	resources := []struct {
		gvr      schema.GroupVersionResource
		typeName string
		parser   func(unstructured.Unstructured) interface{}
	}{
		{BackupGVR, "backup", func(u unstructured.Unstructured) interface{} { return parseBackup(u) }},
		{RestoreGVR, "restore", func(u unstructured.Unstructured) interface{} { return parseRestore(u) }},
		{ScheduleGVR, "schedule", func(u unstructured.Unstructured) interface{} { return parseSchedule(u) }},
		{BackupStorageLocationGVR, "bsl", func(u unstructured.Unstructured) interface{} { return parseBSL(u) }},
	}

	stopCh := make(chan struct{})
	go func() {
		<-ctx.Done()
		close(stopCh)
	}()

	for _, r := range resources {
		go im.watchResource(r.gvr, r.typeName, r.parser, stopCh)
	}

	<-ctx.Done()
	im.logger.Info("Informer manager stopped")
}

func (im *InformerManager) watchResource(
	gvr schema.GroupVersionResource,
	typeName string,
	parser func(unstructured.Unstructured) interface{},
	stopCh <-chan struct{},
) {
	resource := im.client.Dynamic().Resource(gvr).Namespace(im.client.Namespace())

	informer := cache.NewReflector(
		&cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				return resource.List(context.Background(), options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				return resource.Watch(context.Background(), options)
			},
		},
		&unstructured.Unstructured{},
		cache.NewStore(cache.MetaNamespaceKeyFunc),
		30*time.Second,
	)

	im.logger.Info("Starting informer", zap.String("resource", typeName))

	// Use a wrapper store that intercepts events
	wrappedStore := &eventStore{
		inner:    informer,
		typeName: typeName,
		parser:   parser,
		hub:      im.hub,
		logger:   im.logger,
	}
	_ = wrappedStore

	// Run a simple watch loop instead of full informer for event interception
	go im.runWatchLoop(resource, typeName, parser, stopCh)
}

func (im *InformerManager) runWatchLoop(
	resource dynamic.ResourceInterface,
	typeName string,
	parser func(unstructured.Unstructured) interface{},
	stopCh <-chan struct{},
) {
	for {
		select {
		case <-stopCh:
			return
		default:
		}

		watcher, err := resource.Watch(context.Background(), metav1.ListOptions{})
		if err != nil {
			im.logger.Error("Failed to start watch", zap.String("resource", typeName), zap.Error(err))
			time.Sleep(5 * time.Second)
			continue
		}

		for event := range watcher.ResultChan() {
			select {
			case <-stopCh:
				watcher.Stop()
				return
			default:
			}

			obj, ok := event.Object.(*unstructured.Unstructured)
			if !ok {
				continue
			}

			var action string
			switch event.Type {
			case watch.Added:
				action = "added"
			case watch.Modified:
				action = "modified"
			case watch.Deleted:
				action = "deleted"
			default:
				continue
			}

			parsed := parser(*obj)

			wsEvent := WSEvent{
				Type:      typeName,
				Action:    action,
				Resource:  parsed,
				ClusterID: im.clusterID,
			}

			im.hub.Broadcast(wsEvent)
			im.logger.Debug("Broadcast event",
				zap.String("type", typeName),
				zap.String("action", action),
				zap.String("name", obj.GetName()),
			)

			// Dispatch notifications for failure events
			if im.notifier != nil && (action == "added" || action == "modified") {
				im.checkAndNotify(typeName, obj, parsed)
			}
		}

		im.logger.Warn("Watch channel closed, restarting", zap.String("resource", typeName))
		time.Sleep(2 * time.Second)
	}
}

// checkAndNotify dispatches notifications for failure conditions.
func (im *InformerManager) checkAndNotify(typeName string, obj *unstructured.Unstructured, parsed interface{}) {
	phase := nestedString(obj.Object, "status", "phase")
	name := obj.GetName()

	var payload *NotificationPayload

	switch typeName {
	case "backup":
		switch phase {
		case "Failed":
			payload = &NotificationPayload{
				EventType: "backup_failed",
				Title:     "Backup Failed",
				Message:   fmt.Sprintf("Backup \"%s\" failed", name),
				Resource:  parsed,
			}
		case "PartiallyFailed":
			payload = &NotificationPayload{
				EventType: "backup_partially_failed",
				Title:     "Backup Partially Failed",
				Message:   fmt.Sprintf("Backup \"%s\" completed with errors", name),
				Resource:  parsed,
			}
		}
	case "restore":
		if phase == "Failed" || phase == "PartiallyFailed" {
			payload = &NotificationPayload{
				EventType: "restore_failed",
				Title:     "Restore Failed",
				Message:   fmt.Sprintf("Restore \"%s\" failed", name),
				Resource:  parsed,
			}
		}
	case "bsl":
		if phase == "Unavailable" {
			payload = &NotificationPayload{
				EventType: "bsl_unavailable",
				Title:     "Backup Storage Location Unavailable",
				Message:   fmt.Sprintf("BSL \"%s\" is unavailable", name),
				Resource:  parsed,
			}
		}
	}

	if payload != nil {
		payload.ClusterID = im.clusterID
		payload.ClusterName = im.clusterName
		go im.notifier.Dispatch(context.Background(), *payload)
	}
}

// eventStore is an unused type kept for potential future informer cache integration.
type eventStore struct {
	inner    *cache.Reflector
	typeName string
	parser   func(unstructured.Unstructured) interface{}
	hub      *ws.Hub
	logger   *zap.Logger
}
