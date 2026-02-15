"use client";

import { useState } from "react";
import {
  Title,
  Stack,
  Paper,
  Text,
  Table,
  Badge,
  Group,
  Skeleton,
  Button,
  ActionIcon,
  Tooltip,
  Switch,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash, IconEdit, IconSend, IconBell } from "@tabler/icons-react";
import { StatusBadge } from "@/components/status-badge";
import { CreateBSLModal } from "@/components/create-bsl-modal";
import { CreateVSLModal } from "@/components/create-vsl-modal";
import { EditBSLModal } from "@/components/edit-bsl-modal";
import { EditVSLModal } from "@/components/edit-vsl-modal";
import { ConfirmDelete } from "@/components/confirm-delete";
import { WebhookConfigModal } from "@/components/webhook-config-modal";
import {
  useBackupLocations,
  useSnapshotLocations,
  useServerInfo,
  useCreateBackupLocation,
  useDeleteBackupLocation,
  useUpdateBackupLocation,
  useCreateSnapshotLocation,
  useDeleteSnapshotLocation,
  useUpdateSnapshotLocation,
} from "@/hooks/use-settings";
import { useWebhooks, useDeleteWebhook, useTestWebhook } from "@/hooks/use-webhooks";
import type { BackupStorageLocation, VolumeSnapshotLocation, WebhookConfig } from "@/lib/types";
import { useAuthStore, hasRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default function SettingsPage() {
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [selectedBSL, setSelectedBSL] = useState<string>("");
  const [editingBSL, setEditingBSL] = useState<BackupStorageLocation | null>(null);
  const [createVSLModalOpened, setCreateVSLModalOpened] = useState(false);
  const [deleteVSLModalOpened, setDeleteVSLModalOpened] = useState(false);
  const [editVSLModalOpened, setEditVSLModalOpened] = useState(false);
  const [selectedVSL, setSelectedVSL] = useState<string>("");
  const [editingVSL, setEditingVSL] = useState<VolumeSnapshotLocation | null>(null);
  const [webhookModalOpened, setWebhookModalOpened] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [deleteWebhookModalOpened, setDeleteWebhookModalOpened] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>("");

  const { data: bsls, isLoading: bslLoading } = useBackupLocations();
  const { data: vsls, isLoading: vslLoading } = useSnapshotLocations();
  const { data: serverInfo } = useServerInfo();
  const { role } = useAuthStore();

  const createMutation = useCreateBackupLocation();
  const deleteMutation = useDeleteBackupLocation();
  const updateMutation = useUpdateBackupLocation();
  const createVSLMutation = useCreateSnapshotLocation();
  const deleteVSLMutation = useDeleteSnapshotLocation();
  const updateVSLMutation = useUpdateSnapshotLocation();

  const { data: webhooks } = useWebhooks();
  const deleteWebhookMutation = useDeleteWebhook();
  const testWebhookMutation = useTestWebhook();

  const isAdmin = hasRole(role, "admin");

  const handleDelete = async () => {
    if (!selectedBSL) return;
    await deleteMutation.mutateAsync(selectedBSL);
    setDeleteModalOpened(false);
    setSelectedBSL("");
  };

  const handleDeleteVSL = async () => {
    if (!selectedVSL) return;
    await deleteVSLMutation.mutateAsync(selectedVSL);
    setDeleteVSLModalOpened(false);
    setSelectedVSL("");
  };

  const openDeleteModal = (name: string) => {
    setSelectedBSL(name);
    setDeleteModalOpened(true);
  };

  const openEditModal = (bsl: BackupStorageLocation) => {
    setEditingBSL(bsl);
    setEditModalOpened(true);
  };

  const openEditVSLModal = (vsl: VolumeSnapshotLocation) => {
    setEditingVSL(vsl);
    setEditVSLModalOpened(true);
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Settings</Title>

      {serverInfo && (
        <Paper p="md">
          <Text fw={600} mb="sm">
            Server Info
          </Text>
          <Group>
            <div>
              <Text size="xs" c="dimmed">
                Namespace
              </Text>
              <Text fw={500}>{serverInfo.namespace}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Dashboard Version
              </Text>
              <Text fw={500}>{serverInfo.version}</Text>
            </div>
          </Group>
        </Paper>
      )}

      <Paper p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Backup Storage Locations</Text>
          {isAdmin && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpened(true)}
              size="sm"
            >
              Create BSL
            </Button>
          )}
        </Group>
        {bslLoading ? (
          <Skeleton height={100} />
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Provider</Table.Th>
                <Table.Th>Bucket</Table.Th>
                <Table.Th>Access Mode</Table.Th>
                <Table.Th>Default</Table.Th>
                <Table.Th>Last Validated</Table.Th>
                {isAdmin && <Table.Th style={{ width: 60 }}></Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(bsls || []).map((bsl) => (
                <Table.Tr key={bsl.name}>
                  <Table.Td fw={500}>{bsl.name}</Table.Td>
                  <Table.Td>
                    <StatusBadge phase={bsl.phase} />
                  </Table.Td>
                  <Table.Td>{bsl.provider}</Table.Td>
                  <Table.Td>
                    {bsl.bucket}
                    {bsl.prefix ? `/${bsl.prefix}` : ""}
                  </Table.Td>
                  <Table.Td>{bsl.accessMode}</Table.Td>
                  <Table.Td>
                    {bsl.default && (
                      <Badge color="blue" variant="light" size="sm">
                        Default
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{formatDate(bsl.lastValidated)}</Table.Td>
                  {isAdmin && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => openEditModal(bsl)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => openDeleteModal(bsl.name)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
              {(bsls || []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={isAdmin ? 8 : 7}>
                    <Text size="sm" c="dimmed" ta="center">
                      No backup storage locations found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Paper p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Volume Snapshot Locations</Text>
          {isAdmin && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateVSLModalOpened(true)}
              size="sm"
            >
              Create VSL
            </Button>
          )}
        </Group>
        {vslLoading ? (
          <Skeleton height={100} />
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Provider</Table.Th>
                <Table.Th>Config</Table.Th>
                {isAdmin && <Table.Th style={{ width: 60 }}></Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(vsls || []).map((vsl) => (
                <Table.Tr key={vsl.name}>
                  <Table.Td fw={500}>{vsl.name}</Table.Td>
                  <Table.Td>{vsl.provider}</Table.Td>
                  <Table.Td>
                    {vsl.config
                      ? Object.entries(vsl.config)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")
                      : "-"}
                  </Table.Td>
                  {isAdmin && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => openEditVSLModal(vsl)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => {
                              setSelectedVSL(vsl.name);
                              setDeleteVSLModalOpened(true);
                            }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
              {(vsls || []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={isAdmin ? 4 : 3}>
                    <Text size="sm" c="dimmed" ta="center">
                      No volume snapshot locations found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Webhook Notifications */}
      <Paper p="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconBell size={20} />
            <Text fw={600}>Webhook Notifications</Text>
          </Group>
          {isAdmin && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingWebhook(null);
                setWebhookModalOpened(true);
              }}
              size="sm"
            >
              Add Webhook
            </Button>
          )}
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Events</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Enabled</Table.Th>
              {isAdmin && <Table.Th style={{ width: 100 }}></Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(webhooks || []).map((wh) => (
              <Table.Tr key={wh.id}>
                <Table.Td fw={500}>{wh.name}</Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {wh.type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {wh.events.map((evt) => (
                      <Badge key={evt} variant="outline" size="xs">
                        {evt.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td>
                  {wh.lastStatus ? (
                    <Badge
                      color={wh.lastStatus === "success" ? "green" : "red"}
                      variant="light"
                      size="sm"
                    >
                      {wh.lastStatus}
                    </Badge>
                  ) : (
                    <Text size="xs" c="dimmed">
                      Never sent
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={wh.enabled ? "green" : "gray"}
                    variant="light"
                    size="sm"
                  >
                    {wh.enabled ? "On" : "Off"}
                  </Badge>
                </Table.Td>
                {isAdmin && (
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Send test">
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          loading={testWebhookMutation.isPending}
                          onClick={() => {
                            testWebhookMutation.mutate(wh.id, {
                              onSuccess: () =>
                                notifications.show({
                                  title: "Test sent",
                                  message: `Test notification sent to ${wh.name}`,
                                  color: "green",
                                }),
                              onError: (err) =>
                                notifications.show({
                                  title: "Test failed",
                                  message: err.message,
                                  color: "red",
                                }),
                            });
                          }}
                        >
                          <IconSend size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Edit">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => {
                            setEditingWebhook(wh);
                            setWebhookModalOpened(true);
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            setSelectedWebhookId(wh.id);
                            setDeleteWebhookModalOpened(true);
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {(webhooks || []).length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={isAdmin ? 6 : 5}>
                  <Text size="sm" c="dimmed" ta="center">
                    No webhooks configured. Add a webhook to receive notifications for backup failures, restore
                    issues, and storage location problems.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Modals */}
      <CreateBSLModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        onSuccess={() => {}}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
      />

      <EditBSLModal
        opened={editModalOpened}
        onClose={() => {
          setEditModalOpened(false);
          setEditingBSL(null);
        }}
        onSuccess={() => {}}
        onSubmit={async (name, data) => {
          await updateMutation.mutateAsync({ name, data });
        }}
        bsl={editingBSL}
      />

      <ConfirmDelete
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setSelectedBSL("");
        }}
        onConfirm={handleDelete}
        title="Delete Backup Storage Location"
        message={`Are you sure you want to delete backup storage location "${selectedBSL}"? This action cannot be undone.`}
      />

      <CreateVSLModal
        opened={createVSLModalOpened}
        onClose={() => setCreateVSLModalOpened(false)}
        onSuccess={() => {}}
        onSubmit={async (data) => {
          await createVSLMutation.mutateAsync(data);
        }}
      />

      <EditVSLModal
        opened={editVSLModalOpened}
        onClose={() => {
          setEditVSLModalOpened(false);
          setEditingVSL(null);
        }}
        onSuccess={() => {}}
        onSubmit={async (name, data) => {
          await updateVSLMutation.mutateAsync({ name, data });
        }}
        vsl={editingVSL}
      />

      <ConfirmDelete
        opened={deleteVSLModalOpened}
        onClose={() => {
          setDeleteVSLModalOpened(false);
          setSelectedVSL("");
        }}
        onConfirm={handleDeleteVSL}
        title="Delete Volume Snapshot Location"
        message={`Are you sure you want to delete volume snapshot location "${selectedVSL}"? This action cannot be undone.`}
      />

      <WebhookConfigModal
        opened={webhookModalOpened}
        onClose={() => {
          setWebhookModalOpened(false);
          setEditingWebhook(null);
        }}
        webhook={editingWebhook}
      />

      <ConfirmDelete
        opened={deleteWebhookModalOpened}
        onClose={() => {
          setDeleteWebhookModalOpened(false);
          setSelectedWebhookId("");
        }}
        onConfirm={async () => {
          if (!selectedWebhookId) return;
          await deleteWebhookMutation.mutateAsync(selectedWebhookId);
          setDeleteWebhookModalOpened(false);
          setSelectedWebhookId("");
        }}
        title="Delete Webhook"
        message="Are you sure you want to delete this webhook? This action cannot be undone."
      />
    </Stack>
  );
}
