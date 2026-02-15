"use client";

import { DataTable } from "mantine-datatable";
import { StatusBadge } from "./status-badge";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Restore } from "@/lib/types";

interface RestoreTableProps {
  restores: Restore[];
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  recordsPerPage: number;
  onRecordsPerPageChange: (size: number) => void;
  totalRecords: number;
}

export function RestoreTable({
  restores,
  loading,
  page,
  onPageChange,
  recordsPerPage,
  onRecordsPerPageChange,
  totalRecords,
}: RestoreTableProps) {
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
          render: (restore) => <StatusBadge phase={restore.phase} />,
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
      ]}
      noRecordsText="No restores found"
    />
  );
}
