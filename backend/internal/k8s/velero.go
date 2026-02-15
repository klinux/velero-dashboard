package k8s

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// --- Backups ---

func (c *Client) ListBackups(ctx context.Context) ([]BackupResponse, error) {
	list, err := c.dynamic.Resource(BackupGVR).Namespace(c.namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list backups: %w", err)
	}

	results := make([]BackupResponse, 0, len(list.Items))
	for _, item := range list.Items {
		results = append(results, parseBackup(item))
	}
	return results, nil
}

func (c *Client) GetBackup(ctx context.Context, name string) (*BackupResponse, error) {
	obj, err := c.dynamic.Resource(BackupGVR).Namespace(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get backup %s: %w", name, err)
	}
	b := parseBackup(*obj)
	return &b, nil
}

func (c *Client) CreateBackup(ctx context.Context, req CreateBackupRequest) (*BackupResponse, error) {
	spec := map[string]interface{}{}
	if len(req.IncludedNamespaces) > 0 {
		spec["includedNamespaces"] = toInterfaceSlice(req.IncludedNamespaces)
	}
	if len(req.ExcludedNamespaces) > 0 {
		spec["excludedNamespaces"] = toInterfaceSlice(req.ExcludedNamespaces)
	}
	if len(req.IncludedResources) > 0 {
		spec["includedResources"] = toInterfaceSlice(req.IncludedResources)
	}
	if len(req.ExcludedResources) > 0 {
		spec["excludedResources"] = toInterfaceSlice(req.ExcludedResources)
	}
	if req.StorageLocation != "" {
		spec["storageLocation"] = req.StorageLocation
	}
	if len(req.VolumeSnapshotLocations) > 0 {
		spec["volumeSnapshotLocations"] = toInterfaceSlice(req.VolumeSnapshotLocations)
	}
	if req.TTL != "" {
		spec["ttl"] = req.TTL
	}
	if req.SnapshotVolumes != nil {
		spec["snapshotVolumes"] = *req.SnapshotVolumes
	}
	if req.DefaultVolumesToFS != nil {
		spec["defaultVolumesToFsBackup"] = *req.DefaultVolumesToFS
	}
	if req.LabelSelector != "" {
		spec["labelSelector"] = map[string]interface{}{
			"matchLabels": map[string]interface{}{},
		}
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "Backup",
			"metadata": map[string]interface{}{
				"name":      req.Name,
				"namespace": c.namespace,
			},
			"spec": spec,
		},
	}

	created, err := c.dynamic.Resource(BackupGVR).Namespace(c.namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create backup: %w", err)
	}

	c.logger.Info("Backup created", zap.String("name", req.Name))
	b := parseBackup(*created)
	return &b, nil
}

func (c *Client) DeleteBackup(ctx context.Context, name string) error {
	// Velero uses DeleteBackupRequest CRD for proper cleanup
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "DeleteBackupRequest",
			"metadata": map[string]interface{}{
				"name":      fmt.Sprintf("delete-%s-%d", name, time.Now().Unix()),
				"namespace": c.namespace,
			},
			"spec": map[string]interface{}{
				"backupName": name,
			},
		},
	}

	_, err := c.dynamic.Resource(DeleteBackupRequestGVR).Namespace(c.namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create delete request for backup %s: %w", name, err)
	}

	c.logger.Info("Backup delete requested", zap.String("name", name))
	return nil
}

// --- Restores ---

func (c *Client) ListRestores(ctx context.Context) ([]RestoreResponse, error) {
	list, err := c.dynamic.Resource(RestoreGVR).Namespace(c.namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list restores: %w", err)
	}

	results := make([]RestoreResponse, 0, len(list.Items))
	for _, item := range list.Items {
		results = append(results, parseRestore(item))
	}
	return results, nil
}

func (c *Client) GetRestore(ctx context.Context, name string) (*RestoreResponse, error) {
	obj, err := c.dynamic.Resource(RestoreGVR).Namespace(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get restore %s: %w", name, err)
	}
	r := parseRestore(*obj)
	return &r, nil
}

func (c *Client) CreateRestore(ctx context.Context, req CreateRestoreRequest) (*RestoreResponse, error) {
	spec := map[string]interface{}{
		"backupName": req.BackupName,
	}
	if len(req.IncludedNamespaces) > 0 {
		spec["includedNamespaces"] = toInterfaceSlice(req.IncludedNamespaces)
	}
	if len(req.ExcludedNamespaces) > 0 {
		spec["excludedNamespaces"] = toInterfaceSlice(req.ExcludedNamespaces)
	}
	if len(req.IncludedResources) > 0 {
		spec["includedResources"] = toInterfaceSlice(req.IncludedResources)
	}
	if len(req.ExcludedResources) > 0 {
		spec["excludedResources"] = toInterfaceSlice(req.ExcludedResources)
	}
	if req.RestorePVs != nil {
		spec["restorePVs"] = *req.RestorePVs
	}
	if len(req.NamespaceMapping) > 0 {
		mapping := map[string]interface{}{}
		for k, v := range req.NamespaceMapping {
			mapping[k] = v
		}
		spec["namespaceMapping"] = mapping
	}

	name := req.Name
	if name == "" {
		name = fmt.Sprintf("%s-restore-%d", req.BackupName, time.Now().Unix())
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "Restore",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": c.namespace,
			},
			"spec": spec,
		},
	}

	created, err := c.dynamic.Resource(RestoreGVR).Namespace(c.namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create restore: %w", err)
	}

	c.logger.Info("Restore created", zap.String("name", name))
	r := parseRestore(*created)
	return &r, nil
}

// --- Schedules ---

func (c *Client) ListSchedules(ctx context.Context) ([]ScheduleResponse, error) {
	list, err := c.dynamic.Resource(ScheduleGVR).Namespace(c.namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list schedules: %w", err)
	}

	results := make([]ScheduleResponse, 0, len(list.Items))
	for _, item := range list.Items {
		results = append(results, parseSchedule(item))
	}
	return results, nil
}

func (c *Client) GetSchedule(ctx context.Context, name string) (*ScheduleResponse, error) {
	obj, err := c.dynamic.Resource(ScheduleGVR).Namespace(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get schedule %s: %w", name, err)
	}
	s := parseSchedule(*obj)
	return &s, nil
}

func (c *Client) CreateSchedule(ctx context.Context, req CreateScheduleRequest) (*ScheduleResponse, error) {
	template := map[string]interface{}{}
	if len(req.IncludedNamespaces) > 0 {
		template["includedNamespaces"] = toInterfaceSlice(req.IncludedNamespaces)
	}
	if len(req.ExcludedNamespaces) > 0 {
		template["excludedNamespaces"] = toInterfaceSlice(req.ExcludedNamespaces)
	}
	if len(req.IncludedResources) > 0 {
		template["includedResources"] = toInterfaceSlice(req.IncludedResources)
	}
	if len(req.ExcludedResources) > 0 {
		template["excludedResources"] = toInterfaceSlice(req.ExcludedResources)
	}
	if req.StorageLocation != "" {
		template["storageLocation"] = req.StorageLocation
	}
	if len(req.VolumeSnapshotLocations) > 0 {
		template["volumeSnapshotLocations"] = toInterfaceSlice(req.VolumeSnapshotLocations)
	}
	if req.TTL != "" {
		template["ttl"] = req.TTL
	}
	if req.SnapshotVolumes != nil {
		template["snapshotVolumes"] = *req.SnapshotVolumes
	}
	if req.DefaultVolumesToFS != nil {
		template["defaultVolumesToFsBackup"] = *req.DefaultVolumesToFS
	}

	spec := map[string]interface{}{
		"schedule": req.Schedule,
		"template": template,
	}
	if req.Paused {
		spec["paused"] = true
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "Schedule",
			"metadata": map[string]interface{}{
				"name":      req.Name,
				"namespace": c.namespace,
			},
			"spec": spec,
		},
	}

	created, err := c.dynamic.Resource(ScheduleGVR).Namespace(c.namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create schedule: %w", err)
	}

	c.logger.Info("Schedule created", zap.String("name", req.Name))
	s := parseSchedule(*created)
	return &s, nil
}

func (c *Client) ToggleSchedulePause(ctx context.Context, name string) (*ScheduleResponse, error) {
	obj, err := c.dynamic.Resource(ScheduleGVR).Namespace(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get schedule %s: %w", name, err)
	}

	paused, _, _ := unstructured.NestedBool(obj.Object, "spec", "paused")
	_ = unstructured.SetNestedField(obj.Object, !paused, "spec", "paused")

	updated, err := c.dynamic.Resource(ScheduleGVR).Namespace(c.namespace).Update(ctx, obj, metav1.UpdateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to toggle schedule pause: %w", err)
	}

	c.logger.Info("Schedule pause toggled", zap.String("name", name), zap.Bool("paused", !paused))
	s := parseSchedule(*updated)
	return &s, nil
}

func (c *Client) DeleteSchedule(ctx context.Context, name string) error {
	err := c.dynamic.Resource(ScheduleGVR).Namespace(c.namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete schedule %s: %w", name, err)
	}
	c.logger.Info("Schedule deleted", zap.String("name", name))
	return nil
}

// --- Backup Storage Locations ---

func (c *Client) ListBackupStorageLocations(ctx context.Context) ([]BackupStorageLocationResponse, error) {
	list, err := c.dynamic.Resource(BackupStorageLocationGVR).Namespace(c.namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list backup storage locations: %w", err)
	}

	results := make([]BackupStorageLocationResponse, 0, len(list.Items))
	for _, item := range list.Items {
		results = append(results, parseBSL(item))
	}
	return results, nil
}

func (c *Client) CreateBackupStorageLocation(ctx context.Context, req CreateBackupStorageLocationRequest) (*BackupStorageLocationResponse, error) {
	// Build config based on provider
	config := make(map[string]interface{})

	// Add user-provided config first
	for k, v := range req.Config {
		config[k] = v
	}

	// Add provider-specific config
	switch req.Provider {
	case "aws", "velero.io/aws":
		if req.Region != "" {
			config["region"] = req.Region
		}
		if req.S3Url != "" {
			config["s3Url"] = req.S3Url
		}
		if req.S3ForcePathStyle != nil {
			config["s3ForcePathStyle"] = fmt.Sprintf("%t", *req.S3ForcePathStyle)
		}
	case "gcp", "velero.io/gcp":
		// GCP uses region in config
		if req.Region != "" {
			config["region"] = req.Region
		}
	case "azure", "velero.io/azure":
		if req.StorageAccount != "" {
			config["storageAccount"] = req.StorageAccount
		}
		if req.ResourceGroup != "" {
			config["resourceGroup"] = req.ResourceGroup
		}
		if req.SubscriptionId != "" {
			config["subscriptionId"] = req.SubscriptionId
		}
	}

	spec := map[string]interface{}{
		"provider": req.Provider,
		"objectStorage": map[string]interface{}{
			"bucket": req.Bucket,
		},
	}

	if req.Prefix != "" {
		spec["objectStorage"].(map[string]interface{})["prefix"] = req.Prefix
	}

	if len(config) > 0 {
		spec["config"] = config
	}

	if req.Credential != "" {
		spec["credential"] = map[string]interface{}{
			"name": req.Credential,
			"key":  "cloud",
		}
	}

	if req.Default {
		spec["default"] = true
	}

	if req.AccessMode != "" {
		spec["accessMode"] = req.AccessMode
	} else {
		spec["accessMode"] = "ReadWrite"
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "BackupStorageLocation",
			"metadata": map[string]interface{}{
				"name":      req.Name,
				"namespace": c.namespace,
			},
			"spec": spec,
		},
	}

	created, err := c.dynamic.Resource(BackupStorageLocationGVR).Namespace(c.namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create backup storage location: %w", err)
	}

	c.logger.Info("Backup storage location created", zap.String("name", req.Name), zap.String("provider", req.Provider))
	bsl := parseBSL(*created)
	return &bsl, nil
}

func (c *Client) DeleteBackupStorageLocation(ctx context.Context, name string) error {
	err := c.dynamic.Resource(BackupStorageLocationGVR).Namespace(c.namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete backup storage location %s: %w", name, err)
	}

	c.logger.Info("Backup storage location deleted", zap.String("name", name))
	return nil
}

func (c *Client) UpdateBackupStorageLocation(ctx context.Context, name string, req UpdateBackupStorageLocationRequest) (*BackupStorageLocationResponse, error) {
	// Get current BSL
	obj, err := c.dynamic.Resource(BackupStorageLocationGVR).Namespace(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get backup storage location %s: %w", name, err)
	}

	// Get current spec
	spec, found, err := unstructured.NestedMap(obj.Object, "spec")
	if err != nil || !found {
		return nil, fmt.Errorf("failed to get spec from backup storage location")
	}

	// Update only allowed fields
	if req.AccessMode != "" {
		spec["accessMode"] = req.AccessMode
	}

	if req.Credential != "" {
		spec["credential"] = map[string]interface{}{
			"name": req.Credential,
			"key":  "cloud",
		}
	}

	if req.Config != nil {
		// Get existing config
		config, _, _ := unstructured.NestedMap(spec, "config")
		if config == nil {
			config = make(map[string]interface{})
		}
		// Merge new config
		for k, v := range req.Config {
			config[k] = v
		}
		spec["config"] = config
	}

	if req.Default != nil {
		spec["default"] = *req.Default
	}

	// Update spec
	if err := unstructured.SetNestedMap(obj.Object, spec, "spec"); err != nil {
		return nil, fmt.Errorf("failed to set spec: %w", err)
	}

	// Update resource
	updated, err := c.dynamic.Resource(BackupStorageLocationGVR).Namespace(c.namespace).Update(ctx, obj, metav1.UpdateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to update backup storage location: %w", err)
	}

	c.logger.Info("Backup storage location updated", zap.String("name", name))
	bsl := parseBSL(*updated)
	return &bsl, nil
}

// --- Volume Snapshot Locations ---

func (c *Client) ListVolumeSnapshotLocations(ctx context.Context) ([]VolumeSnapshotLocationResponse, error) {
	list, err := c.dynamic.Resource(VolumeSnapshotLocationGVR).Namespace(c.namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list volume snapshot locations: %w", err)
	}

	results := make([]VolumeSnapshotLocationResponse, 0, len(list.Items))
	for _, item := range list.Items {
		results = append(results, parseVSL(item))
	}
	return results, nil
}

func (c *Client) CreateVolumeSnapshotLocation(ctx context.Context, req CreateVolumeSnapshotLocationRequest) (*VolumeSnapshotLocationResponse, error) {
	// Build provider-specific config
	config := make(map[string]interface{})

	// Merge any additional config provided
	for k, v := range req.Config {
		config[k] = v
	}

	// Add provider-specific fields
	switch req.Provider {
	case "aws", "velero.io/aws":
		if req.Region != "" {
			config["region"] = req.Region
		}
	case "azure", "velero.io/azure":
		if req.ResourceGroup != "" {
			config["resourceGroup"] = req.ResourceGroup
		}
		if req.SubscriptionId != "" {
			config["subscriptionId"] = req.SubscriptionId
		}
	case "gcp", "velero.io/gcp":
		// GCP doesn't require specific fields in config for VSL
	}

	spec := map[string]interface{}{
		"provider": req.Provider,
	}

	if len(config) > 0 {
		spec["config"] = config
	}

	if req.Credential != "" {
		spec["credential"] = map[string]interface{}{
			"name": req.Credential,
			"key":  "cloud",
		}
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "velero.io/v1",
			"kind":       "VolumeSnapshotLocation",
			"metadata": map[string]interface{}{
				"name":      req.Name,
				"namespace": c.namespace,
			},
			"spec": spec,
		},
	}

	created, err := c.dynamic.Resource(VolumeSnapshotLocationGVR).Namespace(c.namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create volume snapshot location: %w", err)
	}

	c.logger.Info("Volume snapshot location created", zap.String("name", req.Name), zap.String("provider", req.Provider))
	vsl := parseVSL(*created)
	return &vsl, nil
}

func (c *Client) DeleteVolumeSnapshotLocation(ctx context.Context, name string) error {
	err := c.dynamic.Resource(VolumeSnapshotLocationGVR).Namespace(c.namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete volume snapshot location %s: %w", name, err)
	}

	c.logger.Info("Volume snapshot location deleted", zap.String("name", name))
	return nil
}

func (c *Client) UpdateVolumeSnapshotLocation(ctx context.Context, name string, req UpdateVolumeSnapshotLocationRequest) (*VolumeSnapshotLocationResponse, error) {
	// Get current VSL
	obj, err := c.dynamic.Resource(VolumeSnapshotLocationGVR).Namespace(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get volume snapshot location %s: %w", name, err)
	}

	// Get current spec
	spec, found, err := unstructured.NestedMap(obj.Object, "spec")
	if err != nil || !found {
		return nil, fmt.Errorf("failed to get spec from volume snapshot location")
	}

	// Update only allowed fields
	if req.Credential != "" {
		spec["credential"] = map[string]interface{}{
			"name": req.Credential,
			"key":  "cloud",
		}
	}

	if req.Config != nil {
		// Get existing config
		config, _, _ := unstructured.NestedMap(spec, "config")
		if config == nil {
			config = make(map[string]interface{})
		}
		// Merge new config
		for k, v := range req.Config {
			config[k] = v
		}
		spec["config"] = config
	}

	// Update spec
	if err := unstructured.SetNestedMap(obj.Object, spec, "spec"); err != nil {
		return nil, fmt.Errorf("failed to set spec: %w", err)
	}

	// Update resource
	updated, err := c.dynamic.Resource(VolumeSnapshotLocationGVR).Namespace(c.namespace).Update(ctx, obj, metav1.UpdateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to update volume snapshot location: %w", err)
	}

	c.logger.Info("Volume snapshot location updated", zap.String("name", name))
	vsl := parseVSL(*updated)
	return &vsl, nil
}

// --- Dashboard Stats ---

func (c *Client) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	backups, err := c.ListBackups(ctx)
	if err != nil {
		return nil, err
	}

	restores, err := c.ListRestores(ctx)
	if err != nil {
		return nil, err
	}

	schedules, err := c.ListSchedules(ctx)
	if err != nil {
		return nil, err
	}

	bsls, err := c.ListBackupStorageLocations(ctx)
	if err != nil {
		return nil, err
	}

	stats := &DashboardStats{
		TotalBackups:     int64(len(backups)),
		TotalRestores:    int64(len(restores)),
		TotalSchedules:   int64(len(schedules)),
		StorageLocations: int64(len(bsls)),
	}

	for _, b := range backups {
		switch b.Phase {
		case "Completed":
			stats.CompletedBackups++
		case "Failed", "PartiallyFailed":
			stats.FailedBackups++
		}
	}

	for _, s := range schedules {
		if !s.Paused {
			stats.ActiveSchedules++
		}
	}

	for _, l := range bsls {
		if l.Phase == "Available" {
			stats.HealthyLocations++
		}
	}

	return stats, nil
}

// --- Parsers ---

func parseBackup(obj unstructured.Unstructured) BackupResponse {
	b := BackupResponse{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Labels:    obj.GetLabels(),
	}

	b.Phase = nestedString(obj.Object, "status", "phase")
	b.Errors = nestedInt64(obj.Object, "status", "errors")
	b.Warnings = nestedInt64(obj.Object, "status", "warnings")
	b.ItemsBackedUp = nestedInt64(obj.Object, "status", "progress", "itemsBackedUp")
	b.TotalItems = nestedInt64(obj.Object, "status", "progress", "totalItems")
	b.StorageLocation = nestedString(obj.Object, "spec", "storageLocation")
	b.TTL = nestedString(obj.Object, "spec", "ttl")
	b.IncludedNamespaces = nestedStringSlice(obj.Object, "spec", "includedNamespaces")
	b.ExcludedNamespaces = nestedStringSlice(obj.Object, "spec", "excludedNamespaces")
	b.IncludedResources = nestedStringSlice(obj.Object, "spec", "includedResources")
	b.ExcludedResources = nestedStringSlice(obj.Object, "spec", "excludedResources")

	b.Created = parseTimePtr(obj.GetCreationTimestamp().Time)
	b.Started = nestedTimePtr(obj.Object, "status", "startTimestamp")
	b.Completed = nestedTimePtr(obj.Object, "status", "completionTimestamp")
	b.Expiration = nestedTimePtr(obj.Object, "status", "expiration")

	return b
}

func parseRestore(obj unstructured.Unstructured) RestoreResponse {
	r := RestoreResponse{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Labels:    obj.GetLabels(),
	}

	r.Phase = nestedString(obj.Object, "status", "phase")
	r.Errors = nestedInt64(obj.Object, "status", "errors")
	r.Warnings = nestedInt64(obj.Object, "status", "warnings")
	r.BackupName = nestedString(obj.Object, "spec", "backupName")
	r.ItemsRestored = nestedInt64(obj.Object, "status", "progress", "itemsRestored")
	r.TotalItems = nestedInt64(obj.Object, "status", "progress", "totalItems")
	r.IncludedNamespaces = nestedStringSlice(obj.Object, "spec", "includedNamespaces")
	r.ExcludedNamespaces = nestedStringSlice(obj.Object, "spec", "excludedNamespaces")
	r.IncludedResources = nestedStringSlice(obj.Object, "spec", "includedResources")
	r.ExcludedResources = nestedStringSlice(obj.Object, "spec", "excludedResources")

	r.Created = parseTimePtr(obj.GetCreationTimestamp().Time)
	r.Started = nestedTimePtr(obj.Object, "status", "startTimestamp")
	r.Completed = nestedTimePtr(obj.Object, "status", "completionTimestamp")

	return r
}

func parseSchedule(obj unstructured.Unstructured) ScheduleResponse {
	s := ScheduleResponse{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Labels:    obj.GetLabels(),
	}

	s.Phase = nestedString(obj.Object, "status", "phase")
	s.Schedule = nestedString(obj.Object, "spec", "schedule")
	s.Paused, _, _ = unstructured.NestedBool(obj.Object, "spec", "paused")
	s.StorageLocation = nestedString(obj.Object, "spec", "template", "storageLocation")
	s.TTL = nestedString(obj.Object, "spec", "template", "ttl")
	s.IncludedNamespaces = nestedStringSlice(obj.Object, "spec", "template", "includedNamespaces")
	s.ExcludedNamespaces = nestedStringSlice(obj.Object, "spec", "template", "excludedNamespaces")

	s.Created = parseTimePtr(obj.GetCreationTimestamp().Time)
	s.LastBackup = nestedTimePtr(obj.Object, "status", "lastBackup")

	return s
}

func parseBSL(obj unstructured.Unstructured) BackupStorageLocationResponse {
	b := BackupStorageLocationResponse{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Labels:    obj.GetLabels(),
	}

	b.Phase = nestedString(obj.Object, "status", "phase")
	b.Provider = nestedString(obj.Object, "spec", "provider")
	b.Bucket = nestedString(obj.Object, "spec", "objectStorage", "bucket")
	b.Prefix = nestedString(obj.Object, "spec", "objectStorage", "prefix")
	b.AccessMode = nestedString(obj.Object, "spec", "accessMode")
	b.Default, _, _ = unstructured.NestedBool(obj.Object, "spec", "default")
	b.LastValidated = nestedTimePtr(obj.Object, "status", "lastValidationTime")

	if cfg, ok, _ := unstructured.NestedStringMap(obj.Object, "spec", "config"); ok {
		b.Config = cfg
	}

	return b
}

func parseVSL(obj unstructured.Unstructured) VolumeSnapshotLocationResponse {
	v := VolumeSnapshotLocationResponse{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Labels:    obj.GetLabels(),
	}

	v.Provider = nestedString(obj.Object, "spec", "provider")
	if cfg, ok, _ := unstructured.NestedStringMap(obj.Object, "spec", "config"); ok {
		v.Config = cfg
	}

	return v
}

// --- Helpers ---

func nestedString(obj map[string]interface{}, fields ...string) string {
	val, _, _ := unstructured.NestedString(obj, fields...)
	return val
}

func nestedInt64(obj map[string]interface{}, fields ...string) int64 {
	val, _, _ := unstructured.NestedInt64(obj, fields...)
	return val
}

func nestedStringSlice(obj map[string]interface{}, fields ...string) []string {
	val, _, _ := unstructured.NestedStringSlice(obj, fields...)
	return val
}

func nestedTimePtr(obj map[string]interface{}, fields ...string) *time.Time {
	val := nestedString(obj, fields...)
	if val == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, val)
	if err != nil {
		return nil
	}
	return &t
}

func parseTimePtr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

func toInterfaceSlice(ss []string) []interface{} {
	out := make([]interface{}, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}
