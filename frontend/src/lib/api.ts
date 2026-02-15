import type {
  Backup,
  Restore,
  Schedule,
  BackupStorageLocation,
  VolumeSnapshotLocation,
  DashboardStats,
  CreateBackupRequest,
  CreateRestoreRequest,
  CreateScheduleRequest,
  CreateBackupStorageLocationRequest,
  CreateVolumeSnapshotLocationRequest,
  UpdateBackupStorageLocationRequest,
  UpdateVolumeSnapshotLocationRequest,
  Cluster,
  CreateClusterRequest,
  UpdateClusterRequest,
  WebhookConfig,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  CrossClusterBackup,
  CrossClusterRestoreRequest,
  UpdateScheduleRequest,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("velero_token");
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (token && token !== "none") {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("velero_token");
      localStorage.removeItem("velero_username");
      localStorage.removeItem("velero_role");
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Helper to add ?cluster=id parameter to API paths
function addClusterParam(path: string, clusterId?: string): string {
  if (!clusterId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}cluster=${encodeURIComponent(clusterId)}`;
}

// Auth
export const getAuthConfig = () =>
  fetchJSON<{ mode: string }>("/auth/config");

export const loginBasic = (username: string, password: string) =>
  fetchJSON<{ token: string; username: string; role: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const getMe = () =>
  fetchJSON<{ username: string; email: string; role: string }>("/auth/me");

// Clusters
export const listClusters = () => fetchJSON<Cluster[]>("/clusters");
export const getCluster = (id: string) => fetchJSON<Cluster>(`/clusters/${id}`);
export const createCluster = (data: CreateClusterRequest) =>
  fetchJSON<Cluster>("/clusters", { method: "POST", body: JSON.stringify(data) });
export const updateCluster = (id: string, data: UpdateClusterRequest) =>
  fetchJSON<Cluster>(`/clusters/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteCluster = (id: string) =>
  fetchJSON<{ message: string }>(`/clusters/${id}`, { method: "DELETE" });

// Dashboard
export const getDashboardStats = (clusterId?: string) =>
  fetchJSON<DashboardStats>(addClusterParam("/dashboard/stats", clusterId));

// Backups
export const listBackups = (clusterId?: string) =>
  fetchJSON<Backup[]>(addClusterParam("/backups", clusterId));
export const getBackup = (name: string, clusterId?: string) =>
  fetchJSON<Backup>(addClusterParam(`/backups/${name}`, clusterId));
export const createBackup = (data: CreateBackupRequest, clusterId?: string) =>
  fetchJSON<Backup>(addClusterParam("/backups", clusterId), {
    method: "POST",
    body: JSON.stringify(data),
  });
export const deleteBackup = (name: string, clusterId?: string) =>
  fetchJSON<{ message: string }>(addClusterParam(`/backups/${name}`, clusterId), {
    method: "DELETE",
  });

export const getBackupLogs = async (
  name: string,
  clusterId?: string
): Promise<string> => {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token && token !== "none") {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const path = addClusterParam(`/backups/${name}/logs`, clusterId);
  const res = await fetch(`${API_BASE}/api${path}`, { headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("velero_token");
      localStorage.removeItem("velero_username");
      localStorage.removeItem("velero_role");
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to fetch logs: ${res.statusText}`);
  }

  return res.text();
};

export const compareBackups = (backup1: string, backup2: string, clusterId?: string) =>
  fetchJSON<import("./types").BackupComparisonResponse>(
    addClusterParam(
      `/backups/compare?backup1=${encodeURIComponent(backup1)}&backup2=${encodeURIComponent(backup2)}`,
      clusterId
    )
  );

// Restores
export const listRestores = (clusterId?: string) =>
  fetchJSON<Restore[]>(addClusterParam("/restores", clusterId));
export const getRestore = (name: string, clusterId?: string) =>
  fetchJSON<Restore>(addClusterParam(`/restores/${name}`, clusterId));
export const createRestore = (data: CreateRestoreRequest, clusterId?: string) =>
  fetchJSON<Restore>(addClusterParam("/restores", clusterId), {
    method: "POST",
    body: JSON.stringify(data),
  });
export const deleteRestore = (name: string, clusterId?: string) =>
  fetchJSON<{ message: string }>(addClusterParam(`/restores/${name}`, clusterId), {
    method: "DELETE",
  });

export const getRestoreLogs = async (
  name: string,
  clusterId?: string
): Promise<string> => {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token && token !== "none") {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const path = addClusterParam(`/restores/${name}/logs`, clusterId);
  const res = await fetch(`${API_BASE}/api${path}`, { headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("velero_token");
      localStorage.removeItem("velero_username");
      localStorage.removeItem("velero_role");
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to fetch logs: ${res.statusText}`);
  }

  return res.text();
};

// Schedules
export const listSchedules = (clusterId?: string) =>
  fetchJSON<Schedule[]>(addClusterParam("/schedules", clusterId));
export const getSchedule = (name: string, clusterId?: string) =>
  fetchJSON<Schedule>(addClusterParam(`/schedules/${name}`, clusterId));
export const createSchedule = (data: CreateScheduleRequest, clusterId?: string) =>
  fetchJSON<Schedule>(addClusterParam("/schedules", clusterId), {
    method: "POST",
    body: JSON.stringify(data),
  });
export const updateSchedule = (name: string, data: UpdateScheduleRequest, clusterId?: string) =>
  fetchJSON<Schedule>(addClusterParam(`/schedules/${name}`, clusterId), {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const deleteSchedule = (name: string, clusterId?: string) =>
  fetchJSON<{ message: string }>(addClusterParam(`/schedules/${name}`, clusterId), {
    method: "DELETE",
  });

// Settings
export const listBackupLocations = (clusterId?: string) =>
  fetchJSON<BackupStorageLocation[]>(
    addClusterParam("/settings/backup-locations", clusterId)
  );
export const createBackupLocation = (
  data: CreateBackupStorageLocationRequest,
  clusterId?: string
) =>
  fetchJSON<BackupStorageLocation>(
    addClusterParam("/settings/backup-locations", clusterId),
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
export const deleteBackupLocation = (name: string, clusterId?: string) =>
  fetchJSON<{ message: string }>(
    addClusterParam(`/settings/backup-locations/${name}`, clusterId),
    {
      method: "DELETE",
    }
  );
export const updateBackupLocation = (
  name: string,
  data: UpdateBackupStorageLocationRequest,
  clusterId?: string
) =>
  fetchJSON<BackupStorageLocation>(
    addClusterParam(`/settings/backup-locations/${name}`, clusterId),
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
export const listSnapshotLocations = (clusterId?: string) =>
  fetchJSON<VolumeSnapshotLocation[]>(
    addClusterParam("/settings/snapshot-locations", clusterId)
  );
export const createSnapshotLocation = (
  data: CreateVolumeSnapshotLocationRequest,
  clusterId?: string
) =>
  fetchJSON<VolumeSnapshotLocation>(
    addClusterParam("/settings/snapshot-locations", clusterId),
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
export const deleteSnapshotLocation = (name: string, clusterId?: string) =>
  fetchJSON<{ message: string }>(
    addClusterParam(`/settings/snapshot-locations/${name}`, clusterId),
    {
      method: "DELETE",
    }
  );
export const updateSnapshotLocation = (
  name: string,
  data: UpdateVolumeSnapshotLocationRequest,
  clusterId?: string
) =>
  fetchJSON<VolumeSnapshotLocation>(
    addClusterParam(`/settings/snapshot-locations/${name}`, clusterId),
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
export const getServerInfo = (clusterId?: string) =>
  fetchJSON<{ namespace: string; version: string }>(
    addClusterParam("/settings/server-info", clusterId)
  );

// Webhook Notifications
export const listWebhooks = () =>
  fetchJSON<WebhookConfig[]>("/notifications/webhooks");
export const createWebhook = (data: CreateWebhookRequest) =>
  fetchJSON<WebhookConfig>("/notifications/webhooks", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const updateWebhook = (id: string, data: UpdateWebhookRequest) =>
  fetchJSON<WebhookConfig>(`/notifications/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const deleteWebhook = (id: string) =>
  fetchJSON<{ message: string }>(`/notifications/webhooks/${id}`, {
    method: "DELETE",
  });
export const testWebhook = (id: string) =>
  fetchJSON<{ message: string }>(`/notifications/webhooks/${id}/test`, {
    method: "POST",
  });

// Cross-Cluster
export const listSharedBackups = () =>
  fetchJSON<CrossClusterBackup[]>("/backups/shared");
export const createCrossClusterRestore = (data: CrossClusterRestoreRequest) =>
  fetchJSON<Restore>("/restores/cross-cluster", {
    method: "POST",
    body: JSON.stringify(data),
  });
