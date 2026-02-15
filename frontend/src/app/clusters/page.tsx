"use client";

import { useState } from "react";
import {
  Container,
  Title,
  Paper,
  Table,
  Badge,
  Group,
  Button,
  ActionIcon,
  Text,
  Stack,
  SimpleGrid,
  rem,
  Tooltip,
  Indicator,
  ThemeIcon,
} from "@mantine/core";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconServer,
  IconCheck,
  IconPlugConnected,
  IconPlugConnectedX,
  IconAlertTriangle,
  IconClock,
} from "@tabler/icons-react";
import { useClusters, useDeleteCluster } from "@/hooks/use-clusters";
import { CreateClusterModal } from "@/components/create-cluster-modal";
import { EditClusterModal } from "@/components/edit-cluster-modal";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import type { Cluster } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

function ClusterSummaryCards({ clusters }: { clusters: Cluster[] }) {
  const connected = clusters.filter((c) => c.status === "connected").length;
  const errored = clusters.filter((c) => c.status === "error").length;
  const disconnected = clusters.filter(
    (c) => c.status === "disconnected"
  ).length;

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }}>
      <Paper p="sm" withBorder>
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Total
        </Text>
        <Text size={rem(24)} fw={700} mt={4}>
          {clusters.length}
        </Text>
      </Paper>
      <Paper p="sm" withBorder>
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Connected
        </Text>
        <Text size={rem(24)} fw={700} c="green" mt={4}>
          {connected}
        </Text>
      </Paper>
      <Paper p="sm" withBorder>
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Error
        </Text>
        <Text size={rem(24)} fw={700} c="red" mt={4}>
          {errored}
        </Text>
      </Paper>
      <Paper p="sm" withBorder>
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Disconnected
        </Text>
        <Text size={rem(24)} fw={700} c="yellow" mt={4}>
          {disconnected}
        </Text>
      </Paper>
    </SimpleGrid>
  );
}

export default function ClustersPage() {
  const { data: clusters, isLoading } = useClusters();
  const deleteCluster = useDeleteCluster();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);

  const handleDelete = (cluster: Cluster) => {
    modals.openConfirmModal({
      title: "Delete Cluster",
      children: (
        <Text>
          Are you sure you want to delete cluster{" "}
          <strong>{cluster.name}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await deleteCluster.mutateAsync(cluster.id);
          notifications.show({
            title: "Success",
            message: `Cluster ${cluster.name} deleted successfully`,
            color: "green",
          });
        } catch (error) {
          notifications.show({
            title: "Error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete cluster",
            color: "red",
          });
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "green";
      case "disconnected":
        return "yellow";
      case "error":
        return "red";
      default:
        return "gray";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <IconPlugConnected size={14} />;
      case "error":
        return <IconAlertTriangle size={14} />;
      default:
        return <IconPlugConnectedX size={14} />;
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <IconServer size={32} />
            <div>
              <Title order={1}>Clusters</Title>
              <Text size="sm" c="dimmed">
                Manage connected Kubernetes clusters
              </Text>
            </div>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add Cluster
          </Button>
        </Group>

        {clusters && clusters.length > 0 && (
          <ClusterSummaryCards clusters={clusters} />
        )}

        <Paper shadow="sm" p="md" withBorder>
          {isLoading ? (
            <Text c="dimmed" ta="center" py="xl">
              Loading clusters...
            </Text>
          ) : !clusters || clusters.length === 0 ? (
            <Stack align="center" gap="md" py="xl">
              <IconServer size={48} opacity={0.3} />
              <Text c="dimmed">No clusters configured</Text>
              <Text size="xs" c="dimmed" ta="center" maw={400}>
                Add your first cluster using a kubeconfig file or service
                account token. You can also pre-configure clusters via Helm
                values or kubectl.
              </Text>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setCreateModalOpen(true)}
              >
                Add your first cluster
              </Button>
            </Stack>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cluster</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Namespace</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Last Check</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {clusters.map((cluster) => (
                  <Table.Tr key={cluster.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Indicator
                          color={getStatusColor(cluster.status)}
                          size={10}
                          processing={cluster.status === "connected"}
                        >
                          <ThemeIcon
                            size="md"
                            radius="md"
                            variant="light"
                            color={getStatusColor(cluster.status)}
                          >
                            <IconServer size={16} />
                          </ThemeIcon>
                        </Indicator>
                        <div>
                          <Group gap={6}>
                            <Text fw={500}>{cluster.name}</Text>
                            {cluster.isDefault && (
                              <Badge
                                size="xs"
                                leftSection={<IconCheck size={10} />}
                                color="blue"
                                variant="light"
                              >
                                Default
                              </Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">
                            {cluster.id.slice(0, 8)}...
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip
                        label={cluster.statusMessage || cluster.status}
                        disabled={!cluster.statusMessage}
                      >
                        <Badge
                          leftSection={getStatusIcon(cluster.status)}
                          color={getStatusColor(cluster.status)}
                          variant="light"
                        >
                          {cluster.status}
                        </Badge>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {cluster.namespace}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconClock
                          size={14}
                          color="var(--mantine-color-dimmed)"
                        />
                        <Text size="sm">
                          {formatDistanceToNow(new Date(cluster.createdAt), {
                            addSuffix: true,
                          })}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {formatDistanceToNow(
                          new Date(cluster.lastHealthCheck),
                          {
                            addSuffix: true,
                          }
                        )}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <Tooltip label="Edit cluster">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => setEditingCluster(cluster)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete cluster">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(cluster)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      <CreateClusterModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <EditClusterModal
        cluster={editingCluster}
        opened={!!editingCluster}
        onClose={() => setEditingCluster(null)}
      />
    </Container>
  );
}
