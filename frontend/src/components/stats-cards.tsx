"use client";

import { SimpleGrid, Paper, Group, Text, Skeleton, rem } from "@mantine/core";
import {
  IconDatabaseExport,
  IconDatabaseImport,
  IconCalendarEvent,
  IconServer,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from "@tabler/icons-react";
import type { DashboardStats } from "@/lib/types";

interface StatsCardsProps {
  stats?: DashboardStats;
  loading: boolean;
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={130} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  const cards = [
    {
      title: "Total Backups",
      value: stats?.totalBackups ?? 0,
      subtitle: `${stats?.completedBackups ?? 0} completed, ${stats?.failedBackups ?? 0} failed`,
      icon: IconDatabaseExport,
      color: "indigo",
    },
    {
      title: "Restores",
      value: stats?.totalRestores ?? 0,
      subtitle: "Total restores performed",
      icon: IconDatabaseImport,
      color: "teal",
    },
    {
      title: "Schedules",
      value: stats?.totalSchedules ?? 0,
      subtitle: `${stats?.activeSchedules ?? 0} active`,
      icon: IconCalendarEvent,
      color: "violet",
    },
    {
      title: "Storage Locations",
      value: stats?.storageLocations ?? 0,
      subtitle: `${stats?.healthyLocations ?? 0} healthy`,
      icon: IconServer,
      color:
        stats?.healthyLocations === stats?.storageLocations ? "green" : "orange",
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
      {cards.map((card) => {
        const successRate =
          card.title === "Total Backups" && stats && stats.totalBackups > 0
            ? Math.round((stats.completedBackups / stats.totalBackups) * 100)
            : null;

        const TrendIcon =
          successRate !== null
            ? successRate >= 90
              ? IconTrendingUp
              : successRate >= 50
                ? IconMinus
                : IconTrendingDown
            : null;

        const trendColor =
          successRate !== null
            ? successRate >= 90
              ? "teal"
              : successRate >= 50
                ? "yellow"
                : "red"
            : undefined;

        return (
          <Paper key={card.title} p="md" className="stat-card">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {card.title}
              </Text>
              <card.icon
                size={20}
                stroke={1.5}
                color={`var(--mantine-color-${card.color}-5)`}
              />
            </Group>

            <Group align="flex-end" gap="xs" mt="md">
              <Text fz={rem(28)} fw={700} lh={1}>
                {card.value}
              </Text>
              {TrendIcon && successRate !== null && (
                <Text c={trendColor} fz="sm" fw={500} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {successRate}%
                  <TrendIcon size={16} stroke={1.5} />
                </Text>
              )}
            </Group>

            <Text fz="xs" c="dimmed" mt={7}>
              {card.subtitle}
            </Text>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}
