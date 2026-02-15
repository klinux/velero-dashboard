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
} from "@mantine/core";
import { IconPlus, IconTrash, IconEdit } from "@tabler/icons-react";
import { StatusBadge } from "@/components/status-badge";
import { CreateBSLModal } from "@/components/create-bsl-modal";
import { CreateVSLModal } from "@/components/create-vsl-modal";
import { EditBSLModal } from "@/components/edit-bsl-modal";
import { EditVSLModal } from "@/components/edit-vsl-modal";
import { ConfirmDelete } from "@/components/confirm-delete";
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
import type { BackupStorageLocation, VolumeSnapshotLocation } from "@/lib/types";
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
    </Stack>
  );
}
