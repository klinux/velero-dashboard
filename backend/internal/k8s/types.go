package k8s

import "time"

// BackupResponse is the DTO returned by the API for a Velero Backup.
type BackupResponse struct {
	Name                string            `json:"name"`
	Namespace           string            `json:"namespace"`
	Phase               string            `json:"phase"`
	Errors              int64             `json:"errors"`
	Warnings            int64             `json:"warnings"`
	Created             *time.Time        `json:"created,omitempty"`
	Started             *time.Time        `json:"started,omitempty"`
	Completed           *time.Time        `json:"completed,omitempty"`
	Expiration          *time.Time        `json:"expiration,omitempty"`
	IncludedNamespaces  []string          `json:"includedNamespaces,omitempty"`
	ExcludedNamespaces  []string          `json:"excludedNamespaces,omitempty"`
	IncludedResources   []string          `json:"includedResources,omitempty"`
	ExcludedResources   []string          `json:"excludedResources,omitempty"`
	StorageLocation     string            `json:"storageLocation"`
	TTL                 string            `json:"ttl,omitempty"`
	Labels              map[string]string `json:"labels,omitempty"`
	ItemsBackedUp       int64             `json:"itemsBackedUp"`
	TotalItems          int64             `json:"totalItems"`
	SnapshotVolumes     *bool             `json:"snapshotVolumes,omitempty"`
	DefaultVolumesToFS  *bool             `json:"defaultVolumesToFsBackup,omitempty"`
}

// RestoreResponse is the DTO returned by the API for a Velero Restore.
type RestoreResponse struct {
	Name               string            `json:"name"`
	Namespace          string            `json:"namespace"`
	Phase              string            `json:"phase"`
	Errors             int64             `json:"errors"`
	Warnings           int64             `json:"warnings"`
	BackupName         string            `json:"backupName"`
	Created            *time.Time        `json:"created,omitempty"`
	Started            *time.Time        `json:"started,omitempty"`
	Completed          *time.Time        `json:"completed,omitempty"`
	IncludedNamespaces []string          `json:"includedNamespaces,omitempty"`
	ExcludedNamespaces []string          `json:"excludedNamespaces,omitempty"`
	IncludedResources  []string          `json:"includedResources,omitempty"`
	ExcludedResources  []string          `json:"excludedResources,omitempty"`
	RestorePVs         *bool             `json:"restorePVs,omitempty"`
	Labels             map[string]string `json:"labels,omitempty"`
	ItemsRestored      int64             `json:"itemsRestored"`
	TotalItems         int64             `json:"totalItems"`
}

// ScheduleResponse is the DTO returned by the API for a Velero Schedule.
type ScheduleResponse struct {
	Name               string            `json:"name"`
	Namespace          string            `json:"namespace"`
	Phase              string            `json:"phase"`
	Schedule           string            `json:"schedule"`
	Paused             bool              `json:"paused"`
	LastBackup         *time.Time        `json:"lastBackup,omitempty"`
	Created            *time.Time        `json:"created,omitempty"`
	IncludedNamespaces []string          `json:"includedNamespaces,omitempty"`
	ExcludedNamespaces []string          `json:"excludedNamespaces,omitempty"`
	TTL                string            `json:"ttl,omitempty"`
	StorageLocation    string            `json:"storageLocation"`
	Labels             map[string]string `json:"labels,omitempty"`
}

// BackupStorageLocationResponse is the DTO for a BSL.
type BackupStorageLocationResponse struct {
	Name               string            `json:"name"`
	Namespace          string            `json:"namespace"`
	Phase              string            `json:"phase"`
	Provider           string            `json:"provider"`
	Bucket             string            `json:"bucket"`
	Prefix             string            `json:"prefix,omitempty"`
	AccessMode         string            `json:"accessMode"`
	Default            bool              `json:"default"`
	LastValidated      *time.Time        `json:"lastValidated,omitempty"`
	Config             map[string]string `json:"config,omitempty"`
	Labels             map[string]string `json:"labels,omitempty"`
}

// VolumeSnapshotLocationResponse is the DTO for a VSL.
type VolumeSnapshotLocationResponse struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Provider  string            `json:"provider"`
	Config    map[string]string `json:"config,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// DashboardStats contains aggregated stats for the dashboard.
type DashboardStats struct {
	TotalBackups     int64 `json:"totalBackups"`
	CompletedBackups int64 `json:"completedBackups"`
	FailedBackups    int64 `json:"failedBackups"`
	TotalRestores    int64 `json:"totalRestores"`
	TotalSchedules   int64 `json:"totalSchedules"`
	ActiveSchedules  int64 `json:"activeSchedules"`
	StorageLocations int64 `json:"storageLocations"`
	HealthyLocations int64 `json:"healthyLocations"`
}

// CreateBackupRequest is the payload for creating a backup.
type CreateBackupRequest struct {
	Name                    string   `json:"name"`
	IncludedNamespaces      []string `json:"includedNamespaces,omitempty"`
	ExcludedNamespaces      []string `json:"excludedNamespaces,omitempty"`
	IncludedResources       []string `json:"includedResources,omitempty"`
	ExcludedResources       []string `json:"excludedResources,omitempty"`
	StorageLocation         string   `json:"storageLocation,omitempty"`
	VolumeSnapshotLocations []string `json:"volumeSnapshotLocations,omitempty"`
	TTL                     string   `json:"ttl,omitempty"`
	SnapshotVolumes         *bool    `json:"snapshotVolumes,omitempty"`
	DefaultVolumesToFS      *bool    `json:"defaultVolumesToFsBackup,omitempty"`
	LabelSelector           string   `json:"labelSelector,omitempty"`
}

// CreateRestoreRequest is the payload for creating a restore.
type CreateRestoreRequest struct {
	Name               string            `json:"name"`
	BackupName         string            `json:"backupName"`
	IncludedNamespaces []string          `json:"includedNamespaces,omitempty"`
	ExcludedNamespaces []string          `json:"excludedNamespaces,omitempty"`
	IncludedResources  []string          `json:"includedResources,omitempty"`
	ExcludedResources  []string          `json:"excludedResources,omitempty"`
	RestorePVs         *bool             `json:"restorePVs,omitempty"`
	NamespaceMapping   map[string]string `json:"namespaceMapping,omitempty"`
}

// CreateScheduleRequest is the payload for creating a schedule.
type CreateScheduleRequest struct {
	Name                    string   `json:"name"`
	Schedule                string   `json:"schedule"`
	IncludedNamespaces      []string `json:"includedNamespaces,omitempty"`
	ExcludedNamespaces      []string `json:"excludedNamespaces,omitempty"`
	IncludedResources       []string `json:"includedResources,omitempty"`
	ExcludedResources       []string `json:"excludedResources,omitempty"`
	StorageLocation         string   `json:"storageLocation,omitempty"`
	VolumeSnapshotLocations []string `json:"volumeSnapshotLocations,omitempty"`
	TTL                     string   `json:"ttl,omitempty"`
	SnapshotVolumes         *bool    `json:"snapshotVolumes,omitempty"`
	DefaultVolumesToFS      *bool    `json:"defaultVolumesToFsBackup,omitempty"`
	LabelSelector           string   `json:"labelSelector,omitempty"`
	Paused                  bool     `json:"paused,omitempty"`
}

// CreateBackupStorageLocationRequest is the payload for creating a BSL.
type CreateBackupStorageLocationRequest struct {
	Name             string            `json:"name"`
	Provider         string            `json:"provider"` // aws, gcp, azure, velero.io/aws (for MinIO)
	Bucket           string            `json:"bucket"`
	Prefix           string            `json:"prefix,omitempty"`
	Region           string            `json:"region,omitempty"`         // AWS/GCP
	S3Url            string            `json:"s3Url,omitempty"`          // MinIO
	S3ForcePathStyle *bool             `json:"s3ForcePathStyle,omitempty"` // MinIO
	StorageAccount   string            `json:"storageAccount,omitempty"` // Azure
	ResourceGroup    string            `json:"resourceGroup,omitempty"`  // Azure
	SubscriptionId   string            `json:"subscriptionId,omitempty"` // Azure
	Credential       string            `json:"credential,omitempty"`     // Name of existing K8s secret
	Config           map[string]string `json:"config,omitempty"`         // Additional provider-specific config
	Default          bool              `json:"default,omitempty"`
	AccessMode       string            `json:"accessMode,omitempty"`     // ReadWrite (default) or ReadOnly
}

// CreateVolumeSnapshotLocationRequest is the payload for creating a VSL.
type CreateVolumeSnapshotLocationRequest struct {
	Name           string            `json:"name"`
	Provider       string            `json:"provider"` // aws, gcp, azure
	Region         string            `json:"region,omitempty"`         // AWS
	ResourceGroup  string            `json:"resourceGroup,omitempty"`  // Azure
	SubscriptionId string            `json:"subscriptionId,omitempty"` // Azure
	Credential     string            `json:"credential,omitempty"`     // Name of existing K8s secret
	Config         map[string]string `json:"config,omitempty"`         // Additional provider-specific config
}

// UpdateBackupStorageLocationRequest is the payload for updating a BSL (limited fields).
type UpdateBackupStorageLocationRequest struct {
	AccessMode string            `json:"accessMode,omitempty"` // ReadWrite or ReadOnly
	Credential string            `json:"credential,omitempty"` // Name of existing K8s secret
	Config     map[string]string `json:"config,omitempty"`     // Additional provider-specific config
	Default    *bool             `json:"default,omitempty"`    // Set as default location
}

// UpdateVolumeSnapshotLocationRequest is the payload for updating a VSL (limited fields).
type UpdateVolumeSnapshotLocationRequest struct {
	Credential string            `json:"credential,omitempty"` // Name of existing K8s secret
	Config     map[string]string `json:"config,omitempty"`     // Additional provider-specific config
}

// WSEvent is a WebSocket message sent to clients on resource changes.
type WSEvent struct {
	Type     string      `json:"type"`     // "backup", "restore", "schedule", "bsl"
	Action   string      `json:"action"`   // "added", "modified", "deleted"
	Resource interface{} `json:"resource"` // The DTO
}
