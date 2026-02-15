"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "@/lib/api";
import type { CreateScheduleRequest, UpdateScheduleRequest } from "@/lib/types";
import { useClusterStore } from "@/lib/cluster";

export function useSchedules() {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["schedules", selectedClusterId],
    queryFn: () => listSchedules(selectedClusterId || undefined),
    refetchInterval: 15000,
    enabled: !!selectedClusterId,
  });
}

export function useSchedule(name: string) {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useQuery({
    queryKey: ["schedules", selectedClusterId, name],
    queryFn: () => getSchedule(name, selectedClusterId || undefined),
    enabled: !!name && !!selectedClusterId,
    refetchInterval: 5000,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (data: CreateScheduleRequest) =>
      createSchedule(data, selectedClusterId || undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["schedules", selectedClusterId] }),
  });
}

export function useToggleSchedulePause() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: ({ name, currentPaused }: { name: string; currentPaused: boolean }) =>
      updateSchedule(name, { paused: !currentPaused }, selectedClusterId || undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["schedules", selectedClusterId] }),
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateScheduleRequest }) =>
      updateSchedule(name, data, selectedClusterId || undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["schedules", selectedClusterId] }),
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

  return useMutation({
    mutationFn: (name: string) =>
      deleteSchedule(name, selectedClusterId || undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["schedules", selectedClusterId] }),
  });
}
