"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listRestores, getRestore, createRestore, deleteRestore, listSharedBackups, createCrossClusterRestore } from "@/lib/api";
import type { CreateRestoreRequest, CrossClusterRestoreRequest } from "@/lib/types";
import { useClusterStore } from "@/lib/cluster";

export function useRestores() {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["restores", selectedClusterId],
    queryFn: () => listRestores(selectedClusterId || undefined),
    refetchInterval: 15000,
    enabled: !!selectedClusterId,
  });
}

export function useRestore(name: string) {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["restores", selectedClusterId, name],
    queryFn: () => getRestore(name, selectedClusterId || undefined),
    enabled: !!name && !!selectedClusterId,
    refetchInterval: 5000,
  });
}

export function useCreateRestore() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (data: CreateRestoreRequest) =>
      createRestore(data, selectedClusterId || undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["restores", selectedClusterId] }),
  });
}

export function useDeleteRestore() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (name: string) =>
      deleteRestore(name, selectedClusterId || undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["restores", selectedClusterId] }),
  });
}

// Cross-Cluster
export function useSharedBackups() {
  return useQuery({
    queryKey: ["shared-backups"],
    queryFn: listSharedBackups,
    refetchInterval: 30000,
  });
}

export function useCreateCrossClusterRestore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CrossClusterRestoreRequest) =>
      createCrossClusterRestore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restores"] });
      queryClient.invalidateQueries({ queryKey: ["shared-backups"] });
    },
  });
}
