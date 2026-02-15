"use client";

import {
  Modal,
  Stack,
  Grid,
  Paper,
  Text,
  Group,
  Badge,
  Divider,
  Loader,
  Alert,
  Table,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowUp,
  IconArrowDown,
  IconEqual,
  IconPlus,
  IconMinus,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { compareBackups } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";
import type { BackupSummary, BackupDiff } from "@/lib/types";

interface CompareBackupsModalProps {
  opened: boolean;
  onClose: () => void;
  backup1Name: string;
  backup2Name: string;
}

export function CompareBackupsModal({
  opened,
  onClose,
  backup1Name,
  backup2Name,
}: CompareBackupsModalProps) {
  const { data: comparison, isLoading, error } = useQuery({
    queryKey: ["compareBackups", backup1Name, backup2Name],
    queryFn: () => compareBackups(backup1Name, backup2Name),
    enabled: opened && !!backup1Name && !!backup2Name,
    retry: 1,
  });

  const renderDiffIcon = (diff: number) => {
    if (diff > 0) return <IconArrowUp size={16} color="green" />;
    if (diff < 0) return <IconArrowDown size={16} color="red" />;
    return <IconEqual size={16} color="gray" />;
  };

  const renderDiffBadge = (diff: number, suffix = "") => {
    if (diff === 0) return <Badge color="gray">No change</Badge>;
    const color = diff > 0 ? "green" : "red";
    const sign = diff > 0 ? "+" : "";
    return <Badge color={color}>{`${sign}${diff}${suffix}`}</Badge>;
  };

  const renderListDiff = (added: string[] | null, removed: string[] | null) => {
    const addedList = added || [];
    const removedList = removed || [];

    return (
      <Stack gap="xs">
        {addedList.length > 0 && (
          <Group gap={4}>
            <IconPlus size={14} color="green" />
            <Text size="xs" c="dimmed">Added:</Text>
            {addedList.map((item) => (
              <Badge key={item} color="green" size="sm" variant="light">
                {item}
              </Badge>
            ))}
          </Group>
        )}
        {removedList.length > 0 && (
          <Group gap={4}>
            <IconMinus size={14} color="red" />
            <Text size="xs" c="dimmed">Removed:</Text>
            {removedList.map((item) => (
              <Badge key={item} color="red" size="sm" variant="light">
                {item}
              </Badge>
            ))}
          </Group>
        )}
        {addedList.length === 0 && removedList.length === 0 && (
          <Text size="xs" c="dimmed">No changes</Text>
        )}
      </Stack>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Compare Backups"
      size="xl"
      centered
    >
      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
          <Loader size="md" />
        </div>
      )}

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading comparison"
          color="red"
          mb="md"
        >
          {error instanceof Error ? error.message : "Failed to compare backups"}
        </Alert>
      )}

      {comparison && (
        <Stack gap="md">
          <Grid>
            <Grid.Col span={6}>
              <Paper p="md" withBorder>
                <Text fw={600} size="sm" mb="xs" c="blue">Backup 1</Text>
                <Text fw={700} mb="xs">{comparison.backup1.name}</Text>
                <Text size="xs" c="dimmed">Created: {formatDate(comparison.backup1.created)}</Text>
                <Group gap="xs" mt="xs">
                  <Badge color="blue">{comparison.backup1.phase}</Badge>
                  <Badge variant="light">{comparison.backup1.itemsBackedUp} items</Badge>
                </Group>
              </Paper>
            </Grid.Col>

            <Grid.Col span={6}>
              <Paper p="md" withBorder>
                <Text fw={600} size="sm" mb="xs" c="green">Backup 2</Text>
                <Text fw={700} mb="xs">{comparison.backup2.name}</Text>
                <Text size="xs" c="dimmed">Created: {formatDate(comparison.backup2.created)}</Text>
                <Group gap="xs" mt="xs">
                  <Badge color="green">{comparison.backup2.phase}</Badge>
                  <Badge variant="light">{comparison.backup2.itemsBackedUp} items</Badge>
                </Group>
              </Paper>
            </Grid.Col>
          </Grid>

          <Divider label="Differences" labelPosition="center" />

          <Paper p="md" withBorder>
            <Text fw={600} mb="md">Metrics</Text>
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={500}>Items Backed Up</Table.Td>
                  <Table.Td>{renderDiffIcon(comparison.diff.itemsDiff)}</Table.Td>
                  <Table.Td>{renderDiffBadge(comparison.diff.itemsDiff)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Size</Table.Td>
                  <Table.Td>{renderDiffIcon(comparison.diff.sizeDiff)}</Table.Td>
                  <Table.Td>{renderDiffBadge(comparison.diff.sizeDiff, " bytes")} ({formatBytes(Math.abs(comparison.diff.sizeDiff))})</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Errors</Table.Td>
                  <Table.Td>{renderDiffIcon(comparison.diff.errorsDiff)}</Table.Td>
                  <Table.Td>{renderDiffBadge(comparison.diff.errorsDiff)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Warnings</Table.Td>
                  <Table.Td>{renderDiffIcon(comparison.diff.warningsDiff)}</Table.Td>
                  <Table.Td>{renderDiffBadge(comparison.diff.warningsDiff)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>

          <Paper p="md" withBorder>
            <Text fw={600} mb="md">Namespaces</Text>
            {renderListDiff(comparison.diff.addedNamespaces, comparison.diff.removedNamespaces)}
          </Paper>

          <Paper p="md" withBorder>
            <Text fw={600} mb="md">Resources</Text>
            {renderListDiff(comparison.diff.addedResources, comparison.diff.removedResources)}
          </Paper>

          <Paper p="md" withBorder>
            <Text fw={600} mb="md">Configuration</Text>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm">Storage Location</Text>
                <Badge color={comparison.diff.storageLocationDiff ? "red" : "green"}>
                  {comparison.diff.storageLocationDiff ? "Different" : "Same"}
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">TTL</Text>
                <Badge color={comparison.diff.ttlDiff ? "red" : "green"}>
                  {comparison.diff.ttlDiff ? "Different" : "Same"}
                </Badge>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      )}
    </Modal>
  );
}
