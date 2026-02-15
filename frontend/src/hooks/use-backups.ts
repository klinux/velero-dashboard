"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBackups, getBackup, createBackup, deleteBackup } from "@/lib/api";
import type { CreateBackupRequest } from "@/lib/types";
import { useClusterStore } from "@/lib/cluster";

export function useBackups() {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["backups", selectedClusterId],
    queryFn: () => listBackups(selectedClusterId || undefined),
    refetchInterval: 15000,
    enabled: !!selectedClusterId,
  });
}

export function useBackup(name: string) {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["backups", selectedClusterId, name],
    queryFn: () => getBackup(name, selectedClusterId || undefined),
    enabled: !!name && !!selectedClusterId,
    refetchInterval: 5000,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (data: CreateBackupRequest) =>
      createBackup(data, selectedClusterId || undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["backups", selectedClusterId] }),
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (name: string) => deleteBackup(name, selectedClusterId || undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["backups", selectedClusterId] }),
  });
}
