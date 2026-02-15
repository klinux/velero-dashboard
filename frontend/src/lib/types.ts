export interface Backup {
  name: string;
  namespace: string;
  phase: string;
  errors: number;
  warnings: number;
  created?: string;
  started?: string;
  completed?: string;
  expiration?: string;
  includedNamespaces?: string[];
  excludedNamespaces?: string[];
  includedResources?: string[];
  excludedResources?: string[];
  storageLocation: string;
  ttl?: string;
  labels?: Record<string, string>;
  itemsBackedUp: number;
  totalItems: number;
  sizeBytes?: number;
  snapshotVolumes?: boolean;
  defaultVolumesToFsBackup?: boolean;
}

export interface Restore {
  name: string;
  namespace: string;
  phase: string;
  errors: number;
  warnings: number;
  backupName: string;
  created?: string;
  started?: string;
  completed?: string;
  includedNamespaces?: string[];
  excludedNamespaces?: string[];
  includedResources?: string[];
  excludedResources?: string[];
  restorePVs?: boolean;
  existingResourcePolicy?: string;
  namespaceMapping?: Record<string, string>;
  labels?: Record<string, string>;
  itemsRestored: number;
  totalItems: number;
}

export interface Schedule {
  name: string;
  namespace: string;
  phase: string;
  schedule: string;
  paused: boolean;
  lastBackup?: string;
  created?: string;
  includedNamespaces?: string[];
  excludedNamespaces?: string[];
  ttl?: string;
  storageLocation: string;
  labels?: Record<string, string>;
}

export interface BackupStorageLocation {
  name: string;
  namespace: string;
  phase: string;
  provider: string;
  bucket: string;
  prefix?: string;
  accessMode: string;
  default: boolean;
  lastValidated?: string;
  config?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface VolumeSnapshotLocation {
  name: string;
  namespace: string;
  provider: string;
  config?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface DashboardStats {
  totalBackups: number;
  completedBackups: number;
  failedBackups: number;
  totalRestores: number;
  totalSchedules: number;
  activeSchedules: number;
  storageLocations: number;
  healthyLocations: number;
}

export interface CreateBackupRequest {
  name: string;
  includedNamespaces?: string[];
  excludedNamespaces?: string[];
  includedResources?: string[];
  excludedResources?: string[];
  storageLocation?: string;
  volumeSnapshotLocations?: string[];
  ttl?: string;
  snapshotVolumes?: boolean;
  defaultVolumesToFsBackup?: boolean;
  labelSelector?: string;
}

export interface CreateRestoreRequest {
  name?: string;
  backupName: string;
  includedNamespaces?: string[];
  excludedNamespaces?: string[];
  includedResources?: string[];
  excludedResources?: string[];
  restorePVs?: boolean;
  namespaceMapping?: Record<string, string>;
  existingResourcePolicy?: "none" | "update";
}

export interface CreateScheduleRequest {
  name: string;
  schedule: string;
  includedNamespaces?: string[];
  excludedNamespaces?: string[];
  includedResources?: string[];
  excludedResources?: string[];
  storageLocation?: string;
  volumeSnapshotLocations?: string[];
  ttl?: string;
  snapshotVolumes?: boolean;
  defaultVolumesToFsBackup?: boolean;
  labelSelector?: string;
  paused?: boolean;
}

export interface CreateBackupStorageLocationRequest {
  name: string;
  provider: string; // aws, gcp, azure, velero.io/aws
  bucket: string;
  prefix?: string;
  region?: string; // AWS/GCP
  s3Url?: string; // MinIO
  s3ForcePathStyle?: boolean; // MinIO
  storageAccount?: string; // Azure
  resourceGroup?: string; // Azure
  subscriptionId?: string; // Azure
  credential?: string; // Name of existing K8s secret
  config?: Record<string, string>; // Additional provider-specific config
  default?: boolean;
  accessMode?: string; // ReadWrite (default) or ReadOnly
}

export interface CreateVolumeSnapshotLocationRequest {
  name: string;
  provider: string; // aws, gcp, azure
  region?: string; // AWS
  resourceGroup?: string; // Azure
  subscriptionId?: string; // Azure
  credential?: string; // Name of existing K8s secret
  config?: Record<string, string>; // Additional provider-specific config
}

export interface UpdateBackupStorageLocationRequest {
  accessMode?: string; // ReadWrite or ReadOnly
  credential?: string; // Name of existing K8s secret
  config?: Record<string, string>; // Additional provider-specific config
  default?: boolean;
}

export interface UpdateVolumeSnapshotLocationRequest {
  credential?: string; // Name of existing K8s secret
  config?: Record<string, string>; // Additional provider-specific config
}

export interface Cluster {
  id: string;
  name: string;
  namespace: string;
  status: "connected" | "disconnected" | "error";
  statusMessage?: string;
  isDefault: boolean;
  createdAt: string;
  lastHealthCheck: string;
}

export interface CreateClusterRequest {
  name: string;
  namespace: string;
  setAsDefault: boolean;

  // Auth Mode 1: Kubeconfig (traditional)
  kubeconfig?: string;

  // Auth Mode 2: Token-based (alternative)
  apiServer?: string;
  token?: string;
  caCert?: string;
  insecureSkipTLS?: boolean;
}

export interface UpdateClusterRequest {
  name?: string;
  kubeconfig?: string;
  namespace?: string;
  setAsDefault?: boolean;
}

export interface WSEvent {
  type: "backup" | "restore" | "schedule" | "bsl";
  action: "added" | "modified" | "deleted";
  resource: Backup | Restore | Schedule | BackupStorageLocation;
  clusterId?: string;
}

export interface BackupComparisonResponse {
  backup1: BackupSummary;
  backup2: BackupSummary;
  diff: BackupDiff;
}

export interface BackupSummary {
  name: string;
  phase: string;
  created: string;
  itemsBackedUp: number;
  totalItems: number;
  errors: number;
  warnings: number;
  sizeBytes: number;
  storageLocation: string;
  includedNamespaces: string[];
  excludedNamespaces: string[];
  includedResources: string[];
  excludedResources: string[];
  ttl: string;
}

export interface BackupDiff {
  itemsDiff: number;
  errorsDiff: number;
  warningsDiff: number;
  sizeDiff: number;
  addedNamespaces: string[];
  removedNamespaces: string[];
  addedResources: string[];
  removedResources: string[];
  sameConfiguration: boolean;
  storageLocationDiff: boolean;
  ttlDiff: boolean;
}

// Webhook Notifications
export type WebhookType = "slack" | "teams" | "discord" | "webhook";
export type NotificationEventType =
  | "backup_failed"
  | "backup_partially_failed"
  | "restore_failed"
  | "bsl_unavailable";

export interface WebhookConfig {
  id: string;
  name: string;
  type: WebhookType;
  url: string;
  events: NotificationEventType[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastSentAt?: string;
  lastStatus?: string;
  lastError?: string;
}

export interface CreateWebhookRequest {
  name: string;
  type: WebhookType;
  url: string;
  events: NotificationEventType[];
  enabled: boolean;
}

export interface UpdateWebhookRequest {
  name?: string;
  type?: WebhookType;
  url?: string;
  events?: NotificationEventType[];
  enabled?: boolean;
}

// Cross-Cluster Restore
export interface CrossClusterBackup extends Backup {
  sourceClusterId: string;
  sourceClusterName: string;
}

export interface CrossClusterRestoreRequest extends CreateRestoreRequest {
  sourceClusterId: string;
  targetClusterId: string;
}
