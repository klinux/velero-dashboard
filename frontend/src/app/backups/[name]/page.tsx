"use client";

import {
  Title,
  Stack,
  Paper,
  Text,
  Group,
  Grid,
  Badge,
  Skeleton,
  Anchor,
  Table,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useBackup } from "@/hooks/use-backups";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDuration } from "@/lib/utils";

export default function BackupDetailPage() {
  const params = useParams();
  const name = params.name as string;
  const { data: backup, isLoading } = useBackup(name);

  if (isLoading) {
    return (
      <Stack>
        <Skeleton height={30} width={300} />
        <Skeleton height={200} />
        <Skeleton height={200} />
      </Stack>
    );
  }

  if (!backup) {
    return (
      <Stack>
        <Text>Backup not found</Text>
        <Anchor component={Link} href="/backups">
          Back to backups
        </Anchor>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group>
        <Anchor component={Link} href="/backups" c="dimmed">
          <IconArrowLeft size={20} />
        </Anchor>
        <Title order={2}>{backup.name}</Title>
        <StatusBadge phase={backup.phase} />
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md">
            <Text fw={600} mb="sm">
              Details
            </Text>
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={500}>Namespace</Table.Td>
                  <Table.Td>{backup.namespace}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Storage Location</Table.Td>
                  <Table.Td>{backup.storageLocation || "-"}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>TTL</Table.Td>
                  <Table.Td>{backup.ttl || "-"}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Created</Table.Td>
                  <Table.Td>{formatDate(backup.created)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Started</Table.Td>
                  <Table.Td>{formatDate(backup.started)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Completed</Table.Td>
                  <Table.Td>{formatDate(backup.completed)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Duration</Table.Td>
                  <Table.Td>{formatDuration(backup.started, backup.completed)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Expiration</Table.Td>
                  <Table.Td>{formatDate(backup.expiration)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="lg">
            <Paper p="md">
              <Text fw={600} mb="sm">
                Progress
              </Text>
              <Group>
                <div>
                  <Text size="xs" c="dimmed">
                    Items Backed Up
                  </Text>
                  <Text size="lg" fw={700}>
                    {backup.itemsBackedUp} / {backup.totalItems}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Errors
                  </Text>
                  <Text size="lg" fw={700} c={backup.errors > 0 ? "red" : undefined}>
                    {backup.errors}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Warnings
                  </Text>
                  <Text size="lg" fw={700} c={backup.warnings > 0 ? "yellow" : undefined}>
                    {backup.warnings}
                  </Text>
                </div>
              </Group>
            </Paper>

            <Paper p="md">
              <Text fw={600} mb="sm">
                Scope
              </Text>
              <Stack gap="xs">
                <div>
                  <Text size="xs" c="dimmed">
                    Included Namespaces
                  </Text>
                  <Group gap={4}>
                    {(backup.includedNamespaces?.length ?? 0) > 0
                      ? backup.includedNamespaces!.map((ns) => (
                          <Badge key={ns} variant="light" size="sm">
                            {ns}
                          </Badge>
                        ))
                      : <Text size="sm">* (all)</Text>}
                  </Group>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Excluded Namespaces
                  </Text>
                  <Group gap={4}>
                    {(backup.excludedNamespaces?.length ?? 0) > 0
                      ? backup.excludedNamespaces!.map((ns) => (
                          <Badge key={ns} variant="light" color="red" size="sm">
                            {ns}
                          </Badge>
                        ))
                      : <Text size="sm">none</Text>}
                  </Group>
                </div>
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
