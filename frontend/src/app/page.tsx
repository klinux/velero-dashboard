"use client";

import {
  Title,
  Stack,
  Paper,
  Text,
  Group,
  Grid,
  RingProgress,
  Center,
  Badge,
  ThemeIcon,
  SimpleGrid,
  rem,
} from "@mantine/core";
import { AreaChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, listBackups, listSchedules } from "@/lib/api";
import { StatsCards } from "@/components/stats-cards";
import { StatusBadge } from "@/components/status-badge";
import { timeAgo, formatBytes } from "@/lib/utils";
import { useClusterStore } from "@/lib/cluster";
import { useClusters } from "@/hooks/use-clusters";
import {
  IconCircleFilled,
  IconCalendarEvent,
  IconClock,
  IconServer,
  IconWorldCheck,
} from "@tabler/icons-react";
import type { Backup, Schedule, DashboardStats } from "@/lib/types";
import Link from "next/link";

function buildActivityData(backups: Backup[]) {
  const now = new Date();
  const days: { date: string; Completed: number; Failed: number; Other: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({ date: key, Completed: 0, Failed: 0, Other: 0 });
  }

  for (const b of backups) {
    if (!b.created) continue;
    const key = new Date(b.created).toISOString().split("T")[0];
    const day = days.find((d) => d.date === key);
    if (!day) continue;
    if (b.phase === "Completed") day.Completed++;
    else if (b.phase === "Failed" || b.phase === "PartiallyFailed") day.Failed++;
    else day.Other++;
  }

  return days.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }),
  }));
}

function CrossClusterOverview({ stats }: { stats?: DashboardStats }) {
  if (!stats) return null;

  const successRate =
    stats.totalBackups > 0
      ? Math.round((stats.completedBackups / stats.totalBackups) * 100)
      : 0;

  const items = [
    { label: "Backups", value: stats.totalBackups, color: "indigo" },
    { label: "Completed", value: stats.completedBackups, color: "teal" },
    { label: "Failed", value: stats.failedBackups, color: "red" },
    { label: "Schedules", value: stats.totalSchedules, color: "violet" },
    { label: "Success Rate", value: `${successRate}%`, color: successRate >= 90 ? "teal" : successRate >= 50 ? "yellow" : "red" },
    { label: "Storage Locations", value: `${stats.healthyLocations}/${stats.storageLocations}`, color: "green" },
  ];

  return (
    <Paper p="md" style={{ borderLeft: `3px solid var(--mantine-color-indigo-5)` }}>
      <Group gap="xs" mb="sm">
        <IconWorldCheck size={18} color="var(--mantine-color-indigo-5)" />
        <Text size="sm" fw={600}>
          All Clusters Overview
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 3, sm: 6 }}>
        {items.map((item) => (
          <div key={item.label}>
            <Text size={rem(20)} fw={700} c={item.color} lh={1.2}>
              {item.value}
            </Text>
            <Text size="xs" c="dimmed">
              {item.label}
            </Text>
          </div>
        ))}
      </SimpleGrid>
    </Paper>
  );
}

export default function DashboardPage() {
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
  const { data: clusters } = useClusters();
  const hasMultipleClusters = (clusters?.length ?? 0) > 1;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", selectedClusterId],
    queryFn: () => getDashboardStats(selectedClusterId || undefined),
    refetchInterval: 10000,
    enabled: !!selectedClusterId,
  });

  const { data: allClustersStats } = useQuery({
    queryKey: ["dashboard", "all"],
    queryFn: () => getDashboardStats("all"),
    refetchInterval: 30000,
    enabled: hasMultipleClusters,
  });

  const { data: backups } = useQuery({
    queryKey: ["backups", selectedClusterId],
    queryFn: () => listBackups(selectedClusterId || undefined),
    refetchInterval: 15000,
    enabled: !!selectedClusterId,
  });

  const { data: schedules } = useQuery({
    queryKey: ["schedules", selectedClusterId],
    queryFn: () => listSchedules(selectedClusterId || undefined),
    refetchInterval: 30000,
    enabled: !!selectedClusterId,
  });

  const recentBackups = (backups || [])
    .sort((a, b) => {
      const dateA = a.created ? new Date(a.created).getTime() : 0;
      const dateB = b.created ? new Date(b.created).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 6);

  const activeSchedules = (schedules || [])
    .filter((s: Schedule) => !s.paused)
    .slice(0, 5);

  const completedPct =
    stats && stats.totalBackups > 0
      ? Math.round((stats.completedBackups / stats.totalBackups) * 100)
      : 0;

  const failedPct =
    stats && stats.totalBackups > 0
      ? Math.round((stats.failedBackups / stats.totalBackups) * 100)
      : 0;

  const inProgressPct = Math.max(0, 100 - completedPct - failedPct);

  // Calculate total storage usage
  const totalStorageBytes = (backups || []).reduce((sum, backup) => {
    return sum + (backup.sizeBytes || 0);
  }, 0);

  const activityData = buildActivityData(backups || []);

  // Show empty state if no cluster is selected
  if (!selectedClusterId) {
    return (
      <Stack gap="lg" align="center" justify="center" style={{ minHeight: "60vh" }}>
        <IconServer size={64} opacity={0.3} />
        <div style={{ textAlign: "center" }}>
          <Title order={2} mb="sm">
            No Cluster Selected
          </Title>
          <Text size="md" c="dimmed" mb="lg">
            {clusters?.length === 0
              ? "Please add a cluster to get started. Go to Settings → Clusters."
              : "Please select a cluster from the dropdown in the header."}
          </Text>
          {clusters?.length === 0 && (
            <Text size="sm" c="dimmed">
              Or configure a cluster via environment variables (KUBECONFIG, VELERO_NAMESPACE)
            </Text>
          )}
        </div>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Dashboard</Title>
        <Text size="sm" c="dimmed">
          Kubernetes backup management overview
        </Text>
      </div>

      {hasMultipleClusters && <CrossClusterOverview stats={allClustersStats} />}

      <StatsCards stats={stats} loading={statsLoading} />

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper p="md" h="100%">
            <Text fw={600} mb="md">
              Backup Activity
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              Last 7 days
            </Text>
            <AreaChart
              h={260}
              data={activityData}
              dataKey="date"
              series={[
                { name: "Completed", color: "teal.6" },
                { name: "Failed", color: "red.6" },
                { name: "Other", color: "gray.5" },
              ]}
              curveType="monotone"
              withDots={false}
              fillOpacity={0.2}
              strokeWidth={2}
              gridAxis="xy"
              tickLine="xy"
            />
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" h="100%">
            <Text fw={600} mb="md">
              Success Rate
            </Text>
            <Center>
              <RingProgress
                size={180}
                thickness={16}
                roundCaps
                label={
                  <Center>
                    <div style={{ textAlign: "center" }}>
                      <Text size="xl" fw={700} lh={1}>
                        {completedPct}%
                      </Text>
                      <Text size="xs" c="dimmed">
                        success
                      </Text>
                    </div>
                  </Center>
                }
                sections={[
                  { value: completedPct, color: "teal" },
                  { value: failedPct, color: "red" },
                  { value: inProgressPct, color: "blue" },
                ]}
              />
            </Center>
            <Group justify="center" gap="lg" mt="md">
              <Group gap={4}>
                <IconCircleFilled size={10} color="var(--mantine-color-teal-6)" />
                <Text size="xs" c="dimmed">
                  Completed
                </Text>
              </Group>
              <Group gap={4}>
                <IconCircleFilled size={10} color="var(--mantine-color-red-6)" />
                <Text size="xs" c="dimmed">
                  Failed
                </Text>
              </Group>
              <Group gap={4}>
                <IconCircleFilled size={10} color="var(--mantine-color-blue-6)" />
                <Text size="xs" c="dimmed">
                  Other
                </Text>
              </Group>
            </Group>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12 }}>
          <Paper p="md">
            <Group justify="space-between" mb="md">
              <Text fw={600}>Storage Usage</Text>
              <Text size="xs" c="dimmed">
                Total backup size (estimated)
              </Text>
            </Group>
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Total Size
                </Text>
                <Text size="xl" fw={700}>
                  {formatBytes(totalStorageBytes)}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Total Backups
                </Text>
                <Text size="xl" fw={700}>
                  {stats?.totalBackups || 0}
                </Text>
              </div>
              {stats && stats.totalBackups > 0 && (
                <div>
                  <Text size="xs" c="dimmed" mb={4}>
                    Avg per Backup
                  </Text>
                  <Text size="xl" fw={700}>
                    {formatBytes(Math.round(totalStorageBytes / (stats.totalBackups || 1)))}
                  </Text>
                </div>
              )}
            </Group>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" h="100%">
            <Group justify="space-between" mb="md">
              <Text fw={600}>Recent Backups</Text>
              <Text
                component={Link}
                href="/backups"
                size="xs"
                c="indigo"
                style={{ textDecoration: "none" }}
              >
                View all
              </Text>
            </Group>
            <Stack gap="sm">
              {recentBackups.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  No backups found
                </Text>
              )}
              {recentBackups.map((backup: Backup) => (
                <Group key={backup.name} justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon
                      size="sm"
                      radius="xl"
                      variant="light"
                      color={
                        backup.phase === "Completed"
                          ? "teal"
                          : backup.phase === "Failed"
                            ? "red"
                            : "blue"
                      }
                    >
                      <IconCircleFilled size={8} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={500} lh={1.3}>
                        {backup.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {timeAgo(backup.created)}
                      </Text>
                    </div>
                  </Group>
                  <StatusBadge phase={backup.phase} />
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" h="100%">
            <Group justify="space-between" mb="md">
              <Text fw={600}>Active Schedules</Text>
              <Text
                component={Link}
                href="/schedules"
                size="xs"
                c="indigo"
                style={{ textDecoration: "none" }}
              >
                View all
              </Text>
            </Group>
            <Stack gap="sm">
              {activeSchedules.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  No active schedules
                </Text>
              )}
              {activeSchedules.map((schedule: Schedule) => (
                <Group key={schedule.name} justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon size="sm" radius="xl" variant="light" color="violet">
                      <IconCalendarEvent size={12} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={500} lh={1.3}>
                        {schedule.name}
                      </Text>
                      <Group gap={4}>
                        <IconClock size={12} color="var(--mantine-color-dimmed)" />
                        <Text size="xs" c="dimmed">
                          {schedule.schedule}
                        </Text>
                      </Group>
                    </div>
                  </Group>
                  {schedule.lastBackup ? (
                    <Text size="xs" c="dimmed">
                      {timeAgo(schedule.lastBackup)}
                    </Text>
                  ) : (
                    <Badge size="xs" variant="light" color="gray">
                      No runs
                    </Badge>
                  )}
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
