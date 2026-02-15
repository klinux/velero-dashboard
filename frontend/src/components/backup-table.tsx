"use client";

import { DataTable } from "mantine-datatable";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconTrash, IconEye, IconRestore } from "@tabler/icons-react";
import { StatusBadge } from "./status-badge";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Backup } from "@/lib/types";
import { useAuthStore, hasRole } from "@/lib/auth";
import Link from "next/link";

interface BackupTableProps {
  backups: Backup[];
  loading: boolean;
  onDelete: (name: string) => void;
  onRestore: (backupName: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  recordsPerPage: number;
  onRecordsPerPageChange: (size: number) => void;
  totalRecords: number;
}

export function BackupTable({
  backups,
  loading,
  onDelete,
  onRestore,
  page,
  onPageChange,
  recordsPerPage,
  onRecordsPerPageChange,
  totalRecords,
}: BackupTableProps) {
  const { role } = useAuthStore();
  const canDelete = hasRole(role, "operator");
  const canRestore = hasRole(role, "operator");

  return (
    <DataTable
      withTableBorder={false}
      borderRadius="md"
      striped
      highlightOnHover
      fetching={loading}
      records={backups}
      idAccessor="name"
      page={page}
      onPageChange={onPageChange}
      recordsPerPage={recordsPerPage}
      onRecordsPerPageChange={onRecordsPerPageChange}
      totalRecords={totalRecords}
      recordsPerPageOptions={[10, 15, 25, 50]}
      columns={[
        {
          accessor: "name",
          title: "Name",
          sortable: true,
        },
        {
          accessor: "phase",
          title: "Status",
          sortable: true,
          render: (backup) => <StatusBadge phase={backup.phase} />,
        },
        {
          accessor: "storageLocation",
          title: "Storage",
          sortable: true,
        },
        {
          accessor: "errors",
          title: "Errors",
          sortable: true,
          textAlign: "center",
        },
        {
          accessor: "warnings",
          title: "Warnings",
          sortable: true,
          textAlign: "center",
        },
        {
          accessor: "created",
          title: "Created",
          sortable: true,
          render: (backup) => formatDate(backup.created),
        },
        {
          accessor: "duration",
          title: "Duration",
          render: (backup) => formatDuration(backup.started, backup.completed),
        },
        {
          accessor: "actions",
          title: "",
          textAlign: "right",
          render: (backup) => (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              <Tooltip label="View details">
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  component={Link}
                  href={`/backups/${backup.name}`}
                >
                  <IconEye size={16} />
                </ActionIcon>
              </Tooltip>
              {canRestore && backup.phase === "Completed" && (
                <Tooltip label="Restore">
                  <ActionIcon
                    variant="subtle"
                    color="green"
                    onClick={() => onRestore(backup.name)}
                  >
                    <IconRestore size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip label="Delete">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => onDelete(backup.name)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          ),
        },
      ]}
      noRecordsText="No backups found"
    />
  );
}
