"use client";

import { DataTable } from "mantine-datatable";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconTrash, IconFileText } from "@tabler/icons-react";
import { StatusBadge } from "./status-badge";
import { RestoreProgress } from "./restore-progress";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Restore } from "@/lib/types";
import { useAuthStore, hasRole } from "@/lib/auth";

interface RestoreTableProps {
  restores: Restore[];
  loading: boolean;
  onViewLogs: (name: string) => void;
  onDelete: (name: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  recordsPerPage: number;
  onRecordsPerPageChange: (size: number) => void;
  totalRecords: number;
}

const LOG_PHASES = ["Completed", "Failed", "PartiallyFailed", "FailedValidation"];

export function RestoreTable({
  restores,
  loading,
  onViewLogs,
  onDelete,
  page,
  onPageChange,
  recordsPerPage,
  onRecordsPerPageChange,
  totalRecords,
}: RestoreTableProps) {
  const { role } = useAuthStore();
  const canManage = hasRole(role, "operator");

  return (
    <DataTable
      withTableBorder={false}
      borderRadius="md"
      striped
      highlightOnHover
      fetching={loading}
      records={restores}
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
          render: (restore) => (
            <div>
              <StatusBadge phase={restore.phase} />
              <RestoreProgress restore={restore} />
            </div>
          ),
        },
        { accessor: "backupName", title: "From Backup", sortable: true },
        { accessor: "errors", title: "Errors", sortable: true, textAlign: "center" },
        { accessor: "warnings", title: "Warnings", sortable: true, textAlign: "center" },
        {
          accessor: "created",
          title: "Created",
          sortable: true,
          render: (restore) => formatDate(restore.created),
        },
        {
          accessor: "duration",
          title: "Duration",
          render: (restore) => formatDuration(restore.started, restore.completed),
        },
        {
          accessor: "actions",
          title: "",
          textAlign: "right",
          render: (restore) => (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              {LOG_PHASES.includes(restore.phase) && (
                <Tooltip label="View Logs">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => onViewLogs(restore.name)}
                  >
                    <IconFileText size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
              {canManage && (
                <Tooltip label="Delete">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => onDelete(restore.name)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          ),
        },
      ]}
      noRecordsText="No restores found"
    />
  );
}
