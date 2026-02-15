"use client";

import { Modal, Code, ScrollArea, Text, Loader, Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { getBackupLogs } from "@/lib/api";

interface LogViewerModalProps {
  opened: boolean;
  onClose: () => void;
  backupName: string;
}

export function LogViewerModal({ opened, onClose, backupName }: LogViewerModalProps) {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["backupLogs", backupName],
    queryFn: () => getBackupLogs(backupName),
    enabled: opened && !!backupName,
    retry: 1,
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Backup Logs: ${backupName}`}
      size="xl"
      centered
    >
      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
          <Loader size="md" />
        </div>
      )}

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading logs"
          color="red"
          mb="md"
        >
          {error instanceof Error ? error.message : "Failed to load backup logs"}
        </Alert>
      )}

      {logs && (
        <>
          <Text size="xs" c="dimmed" mb="xs">
            Backup logs retrieved from storage
          </Text>
          <ScrollArea h={500} type="auto">
            <Code block style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>
              {logs}
            </Code>
          </ScrollArea>
        </>
      )}
    </Modal>
  );
}
