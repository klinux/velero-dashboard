"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSchedules,
  getSchedule,
  createSchedule,
  toggleSchedulePause,
  deleteSchedule,
} from "@/lib/api";
import type { CreateScheduleRequest } from "@/lib/types";

export function useSchedules() {
  return useQuery({
    queryKey: ["schedules"],
    queryFn: listSchedules,
    refetchInterval: 15000,
  });
}

export function useSchedule(name: string) {
  return useQuery({
    queryKey: ["schedules", name],
    queryFn: () => getSchedule(name),
    enabled: !!name,
    refetchInterval: 5000,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateScheduleRequest) => createSchedule(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useToggleSchedulePause() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => toggleSchedulePause(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteSchedule(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
}
