"use client";

import { Title, Stack, Group, Button } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { RestoreTable } from "@/components/restore-table";
import { TableSearchInput } from "@/components/table-search-input";
import { useRestores } from "@/hooks/use-restores";
import { useTableSearch } from "@/hooks/use-table-search";
import { useAuthStore, hasRole } from "@/lib/auth";

export default function RestoresPage() {
  const { role } = useAuthStore();
  const { data: restores, isLoading } = useRestores();

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
    data: restores || [],
    searchableFields: ["name", "phase", "backupName"],
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Restores</Title>
        {hasRole(role, "operator") && (
          <Button component={Link} href="/restores/create" leftSection={<IconPlus size={16} />}>
            Create Restore
          </Button>
        )}
      </Group>

      <TableSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search restores by name, status, backup..."
      />

      <RestoreTable
        restores={paginatedRecords}
        loading={isLoading}
        page={page}
        onPageChange={setPage}
        recordsPerPage={pageSize}
        onRecordsPerPageChange={setPageSize}
        totalRecords={totalRecords}
      />
    </Stack>
  );
}
