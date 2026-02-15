"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBackups, getBackup, createBackup, deleteBackup } from "@/lib/api";
import type { CreateBackupRequest } from "@/lib/types";

export function useBackups() {
  return useQuery({
    queryKey: ["backups"],
    queryFn: listBackups,
    refetchInterval: 15000,
  });
}

export function useBackup(name: string) {
  return useQuery({
    queryKey: ["backups", name],
    queryFn: () => getBackup(name),
    enabled: !!name,
    refetchInterval: 5000,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBackupRequest) => createBackup(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteBackup(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
  });
}
