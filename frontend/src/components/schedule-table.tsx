"use client";

import { DataTable } from "mantine-datatable";
import { ActionIcon, Group, Tooltip, Badge } from "@mantine/core";
import { IconTrash, IconPlayerPause, IconPlayerPlay, IconEdit } from "@tabler/icons-react";
import { StatusBadge } from "./status-badge";
import { formatDate } from "@/lib/utils";
import type { Schedule } from "@/lib/types";
import { useAuthStore, hasRole } from "@/lib/auth";

interface ScheduleTableProps {
  schedules: Schedule[];
  loading: boolean;
  onTogglePause: (name: string, currentPaused: boolean) => void;
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  recordsPerPage: number;
  onRecordsPerPageChange: (size: number) => void;
  totalRecords: number;
}

export function ScheduleTable({
  schedules,
  loading,
  onTogglePause,
  onEdit,
  onDelete,
  page,
  onPageChange,
  recordsPerPage,
  onRecordsPerPageChange,
  totalRecords,
}: ScheduleTableProps) {
  const { role } = useAuthStore();
  const canManage = hasRole(role, "operator");

  return (
    <DataTable
      withTableBorder={false}
      borderRadius="md"
      striped
      highlightOnHover
      fetching={loading}
      records={schedules}
      idAccessor="name"
      page={page}
      onPageChange={onPageChange}
      recordsPerPage={recordsPerPage}
      onRecordsPerPageChange={onRecordsPerPageChange}
      totalRecords={totalRecords}
      recordsPerPageOptions={[10, 15, 25, 50]}
      columns={[
        { accessor: "name", title: "Name", sortable: true },
        {
          accessor: "phase",
          title: "Status",
          sortable: true,
          render: (schedule) => (
            <Group gap={4}>
              <StatusBadge phase={schedule.phase} />
              {schedule.paused && (
                <Badge color="yellow" variant="light" size="sm">
                  Paused
                </Badge>
              )}
            </Group>
          ),
        },
        { accessor: "schedule", title: "Cron", sortable: true },
        { accessor: "storageLocation", title: "Storage", sortable: true },
        {
          accessor: "lastBackup",
          title: "Last Backup",
          sortable: true,
          render: (schedule) => formatDate(schedule.lastBackup),
        },
        {
          accessor: "created",
          title: "Created",
          sortable: true,
          render: (schedule) => formatDate(schedule.created),
        },
        {
          accessor: "actions",
          title: "",
          textAlign: "right",
          render: (schedule) =>
            canManage ? (
              <Group gap={4} justify="flex-end" wrap="nowrap">
                <Tooltip label={schedule.paused ? "Resume" : "Pause"}>
                  <ActionIcon
                    variant="subtle"
                    color={schedule.paused ? "green" : "yellow"}
                    onClick={() => onTogglePause(schedule.name, schedule.paused)}
                  >
                    {schedule.paused ? (
                      <IconPlayerPlay size={16} />
                    ) : (
                      <IconPlayerPause size={16} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Edit">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => onEdit(schedule.name)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => onDelete(schedule.name)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ) : null,
        },
      ]}
      noRecordsText="No schedules found"
    />
  );
}
