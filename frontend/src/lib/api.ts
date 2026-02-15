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

// Dashboard
export const getDashboardStats = () => fetchJSON<DashboardStats>("/dashboard/stats");

// Backups
export const listBackups = () => fetchJSON<Backup[]>("/backups");
export const getBackup = (name: string) => fetchJSON<Backup>(`/backups/${name}`);
export const createBackup = (data: CreateBackupRequest) =>
  fetchJSON<Backup>("/backups", { method: "POST", body: JSON.stringify(data) });
export const deleteBackup = (name: string) =>
  fetchJSON<{ message: string }>(`/backups/${name}`, { method: "DELETE" });

// Restores
export const listRestores = () => fetchJSON<Restore[]>("/restores");
export const getRestore = (name: string) => fetchJSON<Restore>(`/restores/${name}`);
export const createRestore = (data: CreateRestoreRequest) =>
  fetchJSON<Restore>("/restores", { method: "POST", body: JSON.stringify(data) });

// Schedules
export const listSchedules = () => fetchJSON<Schedule[]>("/schedules");
export const getSchedule = (name: string) => fetchJSON<Schedule>(`/schedules/${name}`);
export const createSchedule = (data: CreateScheduleRequest) =>
  fetchJSON<Schedule>("/schedules", { method: "POST", body: JSON.stringify(data) });
export const toggleSchedulePause = (name: string) =>
  fetchJSON<Schedule>(`/schedules/${name}`, { method: "PATCH" });
export const deleteSchedule = (name: string) =>
  fetchJSON<{ message: string }>(`/schedules/${name}`, { method: "DELETE" });

// Settings
export const listBackupLocations = () =>
  fetchJSON<BackupStorageLocation[]>("/settings/backup-locations");
export const createBackupLocation = (data: CreateBackupStorageLocationRequest) =>
  fetchJSON<BackupStorageLocation>("/settings/backup-locations", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const deleteBackupLocation = (name: string) =>
  fetchJSON<{ message: string }>(`/settings/backup-locations/${name}`, {
    method: "DELETE",
  });
export const updateBackupLocation = (name: string, data: UpdateBackupStorageLocationRequest) =>
  fetchJSON<BackupStorageLocation>(`/settings/backup-locations/${name}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const listSnapshotLocations = () =>
  fetchJSON<VolumeSnapshotLocation[]>("/settings/snapshot-locations");
export const createSnapshotLocation = (data: CreateVolumeSnapshotLocationRequest) =>
  fetchJSON<VolumeSnapshotLocation>("/settings/snapshot-locations", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const deleteSnapshotLocation = (name: string) =>
  fetchJSON<{ message: string }>(`/settings/snapshot-locations/${name}`, {
    method: "DELETE",
  });
export const updateSnapshotLocation = (name: string, data: UpdateVolumeSnapshotLocationRequest) =>
  fetchJSON<VolumeSnapshotLocation>(`/settings/snapshot-locations/${name}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const getServerInfo = () =>
  fetchJSON<{ namespace: string; version: string }>("/settings/server-info");
