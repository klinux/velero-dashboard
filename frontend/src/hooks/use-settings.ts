"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listBackupLocations,
  listSnapshotLocations,
  getServerInfo,
  createBackupLocation,
  deleteBackupLocation,
  updateBackupLocation,
  createSnapshotLocation,
  deleteSnapshotLocation,
  updateSnapshotLocation,
} from "@/lib/api";
import type {
  CreateBackupStorageLocationRequest,
  CreateVolumeSnapshotLocationRequest,
  UpdateBackupStorageLocationRequest,
  UpdateVolumeSnapshotLocationRequest,
} from "@/lib/types";

export function useBackupLocations() {
  return useQuery({
    queryKey: ["backup-locations"],
    queryFn: listBackupLocations,
    refetchInterval: 30000,
  });
}

export function useSnapshotLocations() {
  return useQuery({
    queryKey: ["snapshot-locations"],
    queryFn: listSnapshotLocations,
    refetchInterval: 30000,
  });
}

export function useServerInfo() {
  return useQuery({
    queryKey: ["server-info"],
    queryFn: getServerInfo,
    refetchInterval: 60000,
  });
}

export function useCreateBackupLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBackupStorageLocationRequest) => createBackupLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backup-locations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteBackupLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteBackupLocation(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backup-locations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateBackupLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateBackupStorageLocationRequest }) =>
      updateBackupLocation(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backup-locations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateSnapshotLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVolumeSnapshotLocationRequest) => createSnapshotLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshot-locations"] });
    },
  });
}

export function useDeleteSnapshotLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteSnapshotLocation(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshot-locations"] });
    },
  });
}

export function useUpdateSnapshotLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateVolumeSnapshotLocationRequest }) =>
      updateSnapshotLocation(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshot-locations"] });
    },
  });
}
