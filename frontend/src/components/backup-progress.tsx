"use client";

import { Progress, Group, Text } from "@mantine/core";
import type { Backup } from "@/lib/types";

interface BackupProgressProps {
  backup: Backup;
}

export function BackupProgress({ backup }: BackupProgressProps) {
  // Only show progress for InProgress backups
  if (backup.phase !== "InProgress") {
    return null;
  }

  const progress = backup.totalItems > 0
    ? Math.round((backup.itemsBackedUp / backup.totalItems) * 100)
    : 0;

  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Text size="xs" c="dimmed">
          Backing up resources
        </Text>
        <Text size="xs" c="dimmed">
          {backup.itemsBackedUp} / {backup.totalItems} items
        </Text>
      </Group>
      <Progress
        value={progress}
        size="sm"
        color="blue"
        striped
        animated
      />
    </div>
  );
}
