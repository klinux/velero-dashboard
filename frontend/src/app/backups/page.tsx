"use client";

import { Title, Stack, Group, Button, Select, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { BackupTable } from "@/components/backup-table";
import { TableSearchInput } from "@/components/table-search-input";
import { ConfirmDelete } from "@/components/confirm-delete";
import { LogViewerModal } from "@/components/log-viewer-modal";
import { CompareBackupsModal } from "@/components/compare-backups-modal";
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
  const [backup1, setBackup1] = useState<string>("");
  const [backup2, setBackup2] = useState<string>("");
  const [compareOpened, { open: openCompare, close: closeCompare }] = useDisclosure(false);
  const [showComparison, setShowComparison] = useState(false);

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

  const handleStartComparison = () => {
    if (backup1 && backup2) {
      setShowComparison(true);
      closeCompare();
    }
  };

  const backupOptions = (backups || []).map((b) => ({ value: b.name, label: b.name }));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Backups</Title>
        <Group>
          <Button variant="light" onClick={openCompare} disabled={!backups || backups.length < 2}>
            Compare Backups
          </Button>
          {hasRole(role, "operator") && (
            <Button component={Link} href="/backups/create" leftSection={<IconPlus size={16} />}>
              Create Backup
            </Button>
          )}
        </Group>
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

      <Modal opened={compareOpened} onClose={closeCompare} title="Select Backups to Compare" centered>
        <Stack gap="md">
          <Select
            label="First Backup"
            placeholder="Select first backup"
            data={backupOptions}
            value={backup1}
            onChange={(value) => setBackup1(value || "")}
            searchable
          />
          <Select
            label="Second Backup"
            placeholder="Select second backup"
            data={backupOptions.filter((opt) => opt.value !== backup1)}
            value={backup2}
            onChange={(value) => setBackup2(value || "")}
            searchable
            disabled={!backup1}
          />
          <Button onClick={handleStartComparison} disabled={!backup1 || !backup2} fullWidth>
            Compare
          </Button>
        </Stack>
      </Modal>

      {showComparison && backup1 && backup2 && (
        <CompareBackupsModal
          opened={showComparison}
          onClose={() => setShowComparison(false)}
          backup1Name={backup1}
          backup2Name={backup2}
        />
      )}
    </Stack>
  );
}
