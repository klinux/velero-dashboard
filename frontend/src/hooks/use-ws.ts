"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { WebSocketClient } from "@/lib/ws";
import { useClusterStore } from "@/lib/cluster";
import { useClusters } from "./use-clusters";
import type { WSEvent, Cluster } from "@/lib/types";

function getClusterLabel(
  clusterId: string | undefined,
  clusters: Cluster[] | undefined
): string {
  if (!clusterId || !clusters || clusters.length <= 1) return "";
  const cluster = clusters.find((c) => c.id === clusterId);
  return cluster ? ` [${cluster.name}]` : "";
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocketClient | null>(null);
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
  const { data: clusters } = useClusters();

  useEffect(() => {
    const ws = new WebSocketClient();
    wsRef.current = ws;

    const unsubscribe = ws.subscribe((event: WSEvent) => {
      const isSelectedCluster =
        !selectedClusterId || event.clusterId === selectedClusterId;

      // Always invalidate cache for the event's cluster
      switch (event.type) {
        case "backup":
          queryClient.invalidateQueries({
            queryKey: ["backups", event.clusterId],
          });
          queryClient.invalidateQueries({
            queryKey: ["dashboard", event.clusterId],
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard", "all"] });
          break;
        case "restore":
          queryClient.invalidateQueries({
            queryKey: ["restores", event.clusterId],
          });
          queryClient.invalidateQueries({
            queryKey: ["dashboard", event.clusterId],
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard", "all"] });
          break;
        case "schedule":
          queryClient.invalidateQueries({
            queryKey: ["schedules", event.clusterId],
          });
          queryClient.invalidateQueries({
            queryKey: ["dashboard", event.clusterId],
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard", "all"] });
          break;
        case "bsl":
          queryClient.invalidateQueries({
            queryKey: ["backup-locations", event.clusterId],
          });
          queryClient.invalidateQueries({
            queryKey: ["dashboard", event.clusterId],
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard", "all"] });
          break;
      }

      const clusterLabel = getClusterLabel(event.clusterId, clusters);

      // Backup notifications (show for ALL clusters — failures shouldn't be missed)
      if (event.type === "backup" && event.action === "modified") {
        const backup = event.resource as { name: string; phase: string };
        if (backup.phase === "Completed" && isSelectedCluster) {
          notifications.show({
            title: "Backup completed",
            message: `Backup "${backup.name}" completed successfully${clusterLabel}`,
            color: "green",
          });
        } else if (
          backup.phase === "Failed" ||
          backup.phase === "PartiallyFailed"
        ) {
          notifications.show({
            title: `Backup ${backup.phase === "PartiallyFailed" ? "partially failed" : "failed"}`,
            message: `Backup "${backup.name}" failed${clusterLabel}`,
            color: "red",
            autoClose: 10000,
          });
        }
      }

      // Restore notifications
      if (event.type === "restore" && event.action === "modified") {
        const restore = event.resource as { name: string; phase: string };
        if (restore.phase === "Completed" && isSelectedCluster) {
          notifications.show({
            title: "Restore completed",
            message: `Restore "${restore.name}" completed successfully${clusterLabel}`,
            color: "green",
          });
        } else if (
          restore.phase === "Failed" ||
          restore.phase === "PartiallyFailed"
        ) {
          notifications.show({
            title: "Restore failed",
            message: `Restore "${restore.name}" failed${clusterLabel}`,
            color: "red",
            autoClose: 10000,
          });
        }
      }

      // BSL health notifications (show when a storage location becomes unavailable)
      if (event.type === "bsl" && event.action === "modified") {
        const bsl = event.resource as { name: string; phase: string };
        if (bsl.phase === "Unavailable") {
          notifications.show({
            title: "Storage location unavailable",
            message: `Backup storage "${bsl.name}" is unavailable${clusterLabel}`,
            color: "orange",
            autoClose: 10000,
          });
        }
      }
    });

    ws.connect();

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, [queryClient, selectedClusterId, clusters]);
}
