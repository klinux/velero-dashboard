"use client";

import { Select } from "@mantine/core";
import { IconServer, IconCheck } from "@tabler/icons-react";
import { useClusters } from "@/hooks/use-clusters";
import { useClusterStore } from "@/lib/cluster";

export function ClusterSelector() {
  const { data: clusters, isLoading } = useClusters();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
  const setSelectedCluster = useClusterStore((state) => state.setSelectedCluster);

  // Don't show selector if no clusters or only one cluster
  if (!clusters || clusters.length <= 1) {
    return null;
  }

  const selectData = clusters.map((cluster) => ({
    value: cluster.id,
    label: cluster.name,
    disabled: cluster.status !== "connected",
  }));

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId);

  return (
    <Select
      placeholder={isLoading ? "Loading clusters..." : "Select cluster"}
      data={selectData}
      value={selectedClusterId}
      onChange={(value) => {
        if (value) {
          setSelectedCluster(value);
        }
      }}
      leftSection={<IconServer size={16} />}
      rightSection={
        selectedCluster?.isDefault ? (
          <IconCheck size={14} style={{ opacity: 0.5 }} />
        ) : undefined
      }
      comboboxProps={{ withinPortal: true }}
      disabled={isLoading}
      styles={{
        input: {
          minWidth: "200px",
        },
      }}
      renderOption={({ option, checked }) => {
        const cluster = clusters.find((c) => c.id === option.value);
        if (!cluster) return option.label;

        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: checked ? 600 : 400 }}>
                {cluster.name}
                {cluster.isDefault && (
                  <span style={{ fontSize: "0.85em", opacity: 0.6, marginLeft: "4px" }}>
                    (default)
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "0.85em",
                  opacity: 0.6,
                  color:
                    cluster.status === "connected"
                      ? "var(--mantine-color-green-6)"
                      : cluster.status === "error"
                        ? "var(--mantine-color-red-6)"
                        : "var(--mantine-color-yellow-6)",
                }}
              >
                {cluster.status === "connected"
                  ? "Connected"
                  : cluster.status === "error"
                    ? "Error"
                    : "Disconnected"}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
