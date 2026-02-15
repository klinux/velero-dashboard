package k8s

import (
	"context"
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

// InformerManager runs informers for Velero CRDs and broadcasts changes via WebSocket.
type InformerManager struct {
	client *Client
	hub    *ws.Hub
	logger *zap.Logger
}

func NewInformerManager(client *Client, hub *ws.Hub, logger *zap.Logger) *InformerManager {
	return &InformerManager{
		client: client,
		hub:    hub,
		logger: logger,
	}
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

			wsEvent := WSEvent{
				Type:     typeName,
				Action:   action,
				Resource: parser(*obj),
			}

			im.hub.Broadcast(wsEvent)
			im.logger.Debug("Broadcast event",
				zap.String("type", typeName),
				zap.String("action", action),
				zap.String("name", obj.GetName()),
			)
		}

		im.logger.Warn("Watch channel closed, restarting", zap.String("resource", typeName))
		time.Sleep(2 * time.Second)
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
