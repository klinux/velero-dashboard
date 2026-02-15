"use client";

import { Title, Stack, Group, Button, Paper, Accordion, Text, List, Code } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconChecklist } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { RestoreTable } from "@/components/restore-table";
import { TableSearchInput } from "@/components/table-search-input";
import { LogViewerModal } from "@/components/log-viewer-modal";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useRestores, useDeleteRestore } from "@/hooks/use-restores";
import { useTableSearch } from "@/hooks/use-table-search";
import { useAuthStore, hasRole } from "@/lib/auth";

export default function RestoresPage() {
  const { role } = useAuthStore();
  const { data: restores, isLoading } = useRestores();
  const deleteMutation = useDeleteRestore();

  const [logsTarget, setLogsTarget] = useState<string | null>(null);
  const [logsOpened, { open: openLogs, close: closeLogs }] = useDisclosure(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);

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

  const handleViewLogs = (name: string) => {
    setLogsTarget(name);
    openLogs();
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
          title: "Restore deleted",
          message: `Restore "${deleteTarget}" deleted`,
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
        onViewLogs={handleViewLogs}
        onDelete={handleDelete}
        page={page}
        onPageChange={setPage}
        recordsPerPage={pageSize}
        onRecordsPerPageChange={setPageSize}
        totalRecords={totalRecords}
      />

      <LogViewerModal
        opened={logsOpened}
        onClose={closeLogs}
        restoreName={logsTarget || ""}
      />

      <ConfirmDelete
        opened={deleteOpened}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title="Delete Restore"
        message={`Are you sure you want to delete restore "${deleteTarget}"?`}
        loading={deleteMutation.isPending}
      />

      {/* Post-Restore Validation Guide */}
      <Paper withBorder p="md" radius="md">
        <Accordion variant="contained">
          <Accordion.Item value="guide">
            <Accordion.Control icon={<IconChecklist size={18} />}>
              <Text fw={500}>Post-Restore Validation Guide</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <List spacing="sm" size="sm" type="ordered">
                <List.Item>
                  Verify all pods are running:{" "}
                  <Code>kubectl get pods --all-namespaces</Code>
                </List.Item>
                <List.Item>
                  Check PV/PVC bindings:{" "}
                  <Code>kubectl get pv,pvc --all-namespaces</Code>
                  {" "}&mdash; if PVCs show as &quot;Pending&quot; or data seems stale, it likely means
                  the PVCs existed before the restore and were skipped. Velero never overwrites
                  existing PV data. Delete the PVCs/Pods and re-run the restore.
                </List.Item>
                <List.Item>
                  Validate services and endpoints are accessible and correctly configured
                </List.Item>
                <List.Item>
                  Review restore warnings/errors in the restore details &mdash;
                  use <Code>velero restore describe &lt;name&gt;</Code> for detailed output
                </List.Item>
                <List.Item>
                  Check restore logs for issues:{" "}
                  <Code>velero restore logs &lt;name&gt;</Code>
                </List.Item>
                <List.Item>
                  Test application functionality end-to-end (connectivity, data integrity)
                </List.Item>
                <List.Item>
                  Verify ingress/LoadBalancer DNS entries &mdash; cloud-generated IPs may change after
                  restore
                </List.Item>
                <List.Item>
                  Confirm ConfigMaps, Secrets, and ServiceAccounts are present and correct
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Paper>
    </Stack>
  );
}
