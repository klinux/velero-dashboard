"use client";

import { Title, Stack, Group, Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { BackupTable } from "@/components/backup-table";
import { TableSearchInput } from "@/components/table-search-input";
import { ConfirmDelete } from "@/components/confirm-delete";
import { LogViewerModal } from "@/components/log-viewer-modal";
import { useBackups, useDeleteBackup } from "@/hooks/use-backups";
import { useCreateRestore } from "@/hooks/use-restores";
import { useTableSearch } from "@/hooks/use-table-search";
import { useAuthStore, hasRole } from "@/lib/auth";
import { useState } from "react";

export default function BackupsPage() {
  const { role } = useAuthStore();
  const { data: backups, isLoading } = useBackups();
  const deleteMutation = useDeleteBackup();
  const createRestoreMutation = useCreateRestore();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [logsTarget, setLogsTarget] = useState<string>("");
  const [logsOpened, { open: openLogs, close: closeLogs }] = useDisclosure(false);

  const {
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    paginatedRecords,
    totalRecords,
  } = useTableSearch({
    data: backups || [],
    searchableFields: ["name", "phase", "storageLocation"],
  });

  const handleDelete = (name: string) => {
    setDeleteTarget(name);
    openDelete();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        notifications.show({
          title: "Delete requested",
          message: `Backup "${deleteTarget}" deletion initiated`,
          color: "green",
        });
        closeDelete();
        setDeleteTarget(null);
      },
      onError: (err) => {
        notifications.show({
          title: "Delete failed",
          message: err.message,
          color: "red",
        });
      },
    });
  };

  const handleRestore = (backupName: string) => {
    createRestoreMutation.mutate(
      { backupName },
      {
        onSuccess: () => {
          notifications.show({
            title: "Restore created",
            message: `Restore from backup "${backupName}" initiated`,
            color: "green",
          });
        },
        onError: (err) => {
          notifications.show({
            title: "Restore failed",
            message: err.message,
            color: "red",
          });
        },
      }
    );
  };

  const handleViewLogs = (backupName: string) => {
    setLogsTarget(backupName);
    openLogs();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Backups</Title>
        {hasRole(role, "operator") && (
          <Button component={Link} href="/backups/create" leftSection={<IconPlus size={16} />}>
            Create Backup
          </Button>
        )}
      </Group>

      <TableSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search backups by name, status, storage..."
      />

      <BackupTable
        backups={paginatedRecords}
        loading={isLoading}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onViewLogs={handleViewLogs}
        page={page}
        onPageChange={setPage}
        recordsPerPage={pageSize}
        onRecordsPerPageChange={setPageSize}
        totalRecords={totalRecords}
      />

      <ConfirmDelete
        opened={deleteOpened}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title="Delete Backup"
        message={`Are you sure you want to delete backup "${deleteTarget}"? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />

      <LogViewerModal
        opened={logsOpened}
        onClose={closeLogs}
        backupName={logsTarget}
      />
    </Stack>
  );
}
