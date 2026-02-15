"use client";

import { Progress, Group, Text } from "@mantine/core";
import type { Restore } from "@/lib/types";

interface RestoreProgressProps {
  restore: Restore;
}

export function RestoreProgress({ restore }: RestoreProgressProps) {
  // Only show progress for InProgress restores
  if (restore.phase !== "InProgress") {
    return null;
  }

  const progress = restore.totalItems > 0
    ? Math.round((restore.itemsRestored / restore.totalItems) * 100)
    : 0;

  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Text size="xs" c="dimmed">
          Restoring resources
        </Text>
        <Text size="xs" c="dimmed">
          {restore.itemsRestored} / {restore.totalItems} items
        </Text>
      </Group>
      <Progress
        value={progress}
        size="sm"
        color="green"
        striped
        animated
      />
    </div>
  );
}
