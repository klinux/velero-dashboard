"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { WebSocketClient } from "@/lib/ws";
import type { WSEvent } from "@/lib/types";

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const ws = new WebSocketClient();
    wsRef.current = ws;

    const unsubscribe = ws.subscribe((event: WSEvent) => {
      // Invalidate relevant query cache
      switch (event.type) {
        case "backup":
          queryClient.invalidateQueries({ queryKey: ["backups"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          break;
        case "restore":
          queryClient.invalidateQueries({ queryKey: ["restores"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          break;
        case "schedule":
          queryClient.invalidateQueries({ queryKey: ["schedules"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          break;
        case "bsl":
          queryClient.invalidateQueries({ queryKey: ["backup-locations"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          break;
      }

      // Show notification for important events
      if (event.type === "backup" && event.action === "modified") {
        const backup = event.resource as { name: string; phase: string };
        if (backup.phase === "Completed") {
          notifications.show({
            title: "Backup completed",
            message: `Backup "${backup.name}" completed successfully`,
            color: "green",
          });
        } else if (backup.phase === "Failed" || backup.phase === "PartiallyFailed") {
          notifications.show({
            title: "Backup failed",
            message: `Backup "${backup.name}" failed`,
            color: "red",
          });
        }
      }
    });

    ws.connect();

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, [queryClient]);
}
