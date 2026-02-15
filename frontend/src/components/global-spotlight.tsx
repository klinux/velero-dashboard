"use client";

import { Spotlight, spotlight } from "@mantine/spotlight";
import { IconSearch, IconDatabase, IconRestore, IconClock, IconSettings } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useBackups } from "@/hooks/use-backups";
import { useRestores } from "@/hooks/use-restores";
import { useSchedules } from "@/hooks/use-schedules";
import { useMemo } from "react";

export function GlobalSpotlight() {
  const router = useRouter();
  const { data: backups } = useBackups();
  const { data: restores } = useRestores();
  const { data: schedules } = useSchedules();

  const actions = useMemo(() => {
    const items = [];

    // Static navigation items
    items.push(
      {
        id: "dashboard",
        label: "Dashboard",
        description: "Go to dashboard",
        onClick: () => router.push("/"),
        leftSection: <IconDatabase size={20} />,
      },
      {
        id: "backups",
        label: "Backups",
        description: "View all backups",
        onClick: () => router.push("/backups"),
        leftSection: <IconDatabase size={20} />,
      },
      {
        id: "restores",
        label: "Restores",
        description: "View all restores",
        onClick: () => router.push("/restores"),
        leftSection: <IconRestore size={20} />,
      },
      {
        id: "schedules",
        label: "Schedules",
        description: "View all schedules",
        onClick: () => router.push("/schedules"),
        leftSection: <IconClock size={20} />,
      },
      {
        id: "settings",
        label: "Settings",
        description: "View settings",
        onClick: () => router.push("/settings"),
        leftSection: <IconSettings size={20} />,
      }
    );

    // Add backups
    if (backups) {
      backups.forEach((backup) => {
        items.push({
          id: `backup-${backup.name}`,
          label: backup.name,
          description: `Backup • ${backup.phase} • ${backup.storageLocation}`,
          onClick: () => router.push(`/backups/${backup.name}`),
          leftSection: <IconDatabase size={20} />,
          keywords: [backup.phase, backup.storageLocation, "backup"],
        });
      });
    }

    // Add restores
    if (restores) {
      restores.forEach((restore) => {
        items.push({
          id: `restore-${restore.name}`,
          label: restore.name,
          description: `Restore • ${restore.phase} • from ${restore.backupName}`,
          onClick: () => router.push("/restores"),
          leftSection: <IconRestore size={20} />,
          keywords: [restore.phase, restore.backupName, "restore"],
        });
      });
    }

    // Add schedules
    if (schedules) {
      schedules.forEach((schedule) => {
        items.push({
          id: `schedule-${schedule.name}`,
          label: schedule.name,
          description: `Schedule • ${schedule.schedule} • ${schedule.paused ? "Paused" : "Active"}`,
          onClick: () => router.push("/schedules"),
          leftSection: <IconClock size={20} />,
          keywords: [schedule.schedule, schedule.paused ? "paused" : "active", "schedule"],
        });
      });
    }

    return items;
  }, [backups, restores, schedules, router]);

  return (
    <Spotlight
      actions={actions}
      nothingFound="Nothing found..."
      highlightQuery
      searchProps={{
        leftSection: <IconSearch size={20} />,
        placeholder: "Search backups, restores, schedules...",
      }}
      shortcut={["mod + K", "mod + P"]}
    />
  );
}

export { spotlight };
