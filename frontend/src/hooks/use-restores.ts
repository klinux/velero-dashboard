"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listRestores, getRestore, createRestore } from "@/lib/api";
import type { CreateRestoreRequest } from "@/lib/types";

export function useRestores() {
  return useQuery({
    queryKey: ["restores"],
    queryFn: listRestores,
    refetchInterval: 15000,
  });
}

export function useRestore(name: string) {
  return useQuery({
    queryKey: ["restores", name],
    queryFn: () => getRestore(name),
    enabled: !!name,
    refetchInterval: 5000,
  });
}

export function useCreateRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRestoreRequest) => createRestore(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restores"] }),
  });
}
