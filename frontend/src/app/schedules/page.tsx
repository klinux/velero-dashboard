"use client";

import { Title, Stack, Group, Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { ScheduleTable } from "@/components/schedule-table";
import { ScheduleEditModal } from "@/components/schedule-edit-modal";
import { TableSearchInput } from "@/components/table-search-input";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  useSchedules,
  useToggleSchedulePause,
  useDeleteSchedule,
} from "@/hooks/use-schedules";
import { useTableSearch } from "@/hooks/use-table-search";
import { useAuthStore, hasRole } from "@/lib/auth";

export default function SchedulesPage() {
  const { role } = useAuthStore();
  const { data: schedules, isLoading } = useSchedules();
  const togglePause = useToggleSchedulePause();
  const deleteMutation = useDeleteSchedule();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);

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
    data: schedules || [],
    searchableFields: ["name", "phase", "schedule", "storageLocation"],
  });

  const handleTogglePause = (name: string, currentPaused: boolean) => {
    togglePause.mutate({ name, currentPaused }, {
      onSuccess: (schedule) => {
        notifications.show({
          title: schedule.paused ? "Schedule paused" : "Schedule resumed",
          message: `Schedule "${name}" ${schedule.paused ? "paused" : "resumed"}`,
          color: "green",
        });
      },
    });
  };

  const handleEdit = (name: string) => {
    setEditTarget(name);
    openEdit();
  };

  const handleDelete = (name: string) => {
    setDeleteTarget(name);
    openDelete();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        notifications.show({
          title: "Schedule deleted",
          message: `Schedule "${deleteTarget}" deleted`,
          color: "green",
        });
        closeDelete();
        setDeleteTarget(null);
      },
      onError: (err) => {
        notifications.show({ title: "Delete failed", message: err.message, color: "red" });
      },
    });
  };

  const editScheduleData = editTarget
    ? (schedules || []).find((s) => s.name === editTarget) || null
    : null;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Schedules</Title>
        {hasRole(role, "operator") && (
          <Button component={Link} href="/schedules/create" leftSection={<IconPlus size={16} />}>
            Create Schedule
          </Button>
        )}
      </Group>

      <TableSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search schedules by name, status, cron..."
      />

      <ScheduleTable
        schedules={paginatedRecords}
        loading={isLoading}
        onTogglePause={handleTogglePause}
        onEdit={handleEdit}
        onDelete={handleDelete}
        page={page}
        onPageChange={setPage}
        recordsPerPage={pageSize}
        onRecordsPerPageChange={setPageSize}
        totalRecords={totalRecords}
      />

      <ScheduleEditModal
        opened={editOpened}
        onClose={closeEdit}
        schedule={editScheduleData}
      />

      <ConfirmDelete
        opened={deleteOpened}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title="Delete Schedule"
        message={`Are you sure you want to delete schedule "${deleteTarget}"?`}
        loading={deleteMutation.isPending}
      />
    </Stack>
  );
}
