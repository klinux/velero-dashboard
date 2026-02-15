"use client";

import { Drawer, ScrollArea, Text, Loader, Alert, TextInput, Stack, Group, Badge } from "@mantine/core";
import { IconAlertCircle, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { getBackupLogs, getRestoreLogs } from "@/lib/api";
import { useState, useMemo } from "react";
import { useClusterStore } from "@/lib/cluster";

interface LogViewerModalProps {
  opened: boolean;
  onClose: () => void;
  backupName?: string;
  restoreName?: string;
}

function colorizeLogLine(line: string): React.ReactNode {
  // Detect log level and apply color
  const errorPattern = /\b(ERROR|FATAL|FAIL|Failed|failed|error)\b/i;
  const warnPattern = /\b(WARN|WARNING|Warn|warning)\b/i;
  const infoPattern = /\b(INFO|Info|info)\b/i;
  const debugPattern = /\b(DEBUG|Debug|debug|TRACE|Trace)\b/i;
  const successPattern = /\b(SUCCESS|SUCCESS|Completed|completed|OK|ok)\b/i;

  let color = "inherit";
  let weight = "normal";

  if (errorPattern.test(line)) {
    color = "var(--mantine-color-red-6)";
    weight = "500";
  } else if (warnPattern.test(line)) {
    color = "var(--mantine-color-yellow-6)";
  } else if (successPattern.test(line)) {
    color = "var(--mantine-color-teal-6)";
  } else if (infoPattern.test(line)) {
    color = "var(--mantine-color-blue-5)";
  } else if (debugPattern.test(line)) {
    color = "var(--mantine-color-gray-5)";
  }

  return (
    <div style={{ color, fontWeight: weight, fontFamily: "monospace", fontSize: "12px", lineHeight: "1.6" }}>
      {line}
    </div>
  );
}

export function LogViewerModal({ opened, onClose, backupName, restoreName }: LogViewerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
  const resourceName = backupName || restoreName || "";
  const resourceType = backupName ? "Backup" : "Restore";

  const { data: logs, isLoading, error } = useQuery({
    queryKey: [resourceType.toLowerCase() + "Logs", resourceName, selectedClusterId],
    queryFn: () =>
      backupName
        ? getBackupLogs(backupName, selectedClusterId || undefined)
        : getRestoreLogs(restoreName!, selectedClusterId || undefined),
    enabled: opened && !!resourceName,
    retry: 1,
  });

  const { filteredLines, matchCount } = useMemo(() => {
    if (!logs) return { filteredLines: [], matchCount: 0 };

    const lines = logs.split("\n");

    if (!searchQuery.trim()) {
      return { filteredLines: lines, matchCount: lines.length };
    }

    const query = searchQuery.toLowerCase();
    const filtered = lines.filter(line => line.toLowerCase().includes(query));

    return { filteredLines: filtered, matchCount: filtered.length };
  }, [logs, searchQuery]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={`${resourceType} Logs: ${resourceName}`}
      position="right"
      size="xl"
      styles={{
        body: { padding: 0, height: "calc(100% - 60px)" },
        header: { borderBottom: "1px solid var(--mantine-color-gray-3)" },
      }}
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
          m="md"
        >
          {error instanceof Error ? error.message : "Failed to load logs"}
        </Alert>
      )}

      {logs && (
        <Stack gap={0} h="100%">
          <div style={{ padding: "12px", borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed">
                {resourceType} logs retrieved from storage
              </Text>
              <Badge variant="light" size="sm">
                {matchCount} {searchQuery ? "matches" : "lines"}
              </Badge>
            </Group>
            <TextInput
              placeholder="Search logs..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
            />
          </div>
          <ScrollArea style={{ flex: 1 }} type="auto">
            <div style={{ padding: "12px", backgroundColor: "var(--mantine-color-dark-8)" }}>
              {filteredLines.map((line, index) => (
                <div key={index}>{colorizeLogLine(line)}</div>
              ))}
            </div>
          </ScrollArea>
        </Stack>
      )}
    </Drawer>
  );
}
