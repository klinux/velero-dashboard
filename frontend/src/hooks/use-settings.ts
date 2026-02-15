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
import { useClusterStore } from "@/lib/cluster";

export function useBackupLocations() {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["backup-locations", selectedClusterId],
    queryFn: () => listBackupLocations(selectedClusterId || undefined),
    refetchInterval: 30000,
    enabled: !!selectedClusterId,
  });
}

export function useSnapshotLocations() {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["snapshot-locations", selectedClusterId],
    queryFn: () => listSnapshotLocations(selectedClusterId || undefined),
    refetchInterval: 30000,
    enabled: !!selectedClusterId,
  });
}

export function useServerInfo() {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["server-info", selectedClusterId],
    queryFn: () => getServerInfo(selectedClusterId || undefined),
    refetchInterval: 60000,
    enabled: !!selectedClusterId,
  });
}

export function useCreateBackupLocation() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (data: CreateBackupStorageLocationRequest) =>
      createBackupLocation(data, selectedClusterId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["backup-locations", selectedClusterId],
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard", selectedClusterId] });
    },
  });
}

export function useDeleteBackupLocation() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (name: string) =>
      deleteBackupLocation(name, selectedClusterId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["backup-locations", selectedClusterId],
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard", selectedClusterId] });
    },
  });
}

export function useUpdateBackupLocation() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateBackupStorageLocationRequest }) =>
      updateBackupLocation(name, data, selectedClusterId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["backup-locations", selectedClusterId],
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard", selectedClusterId] });
    },
  });
}

export function useCreateSnapshotLocation() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (data: CreateVolumeSnapshotLocationRequest) =>
      createSnapshotLocation(data, selectedClusterId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["snapshot-locations", selectedClusterId],
      });
    },
  });
}

export function useDeleteSnapshotLocation() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (name: string) =>
      deleteSnapshotLocation(name, selectedClusterId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["snapshot-locations", selectedClusterId],
      });
    },
  });
}

export function useUpdateSnapshotLocation() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateVolumeSnapshotLocationRequest }) =>
      updateSnapshotLocation(name, data, selectedClusterId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["snapshot-locations", selectedClusterId],
      });
    },
  });
}
