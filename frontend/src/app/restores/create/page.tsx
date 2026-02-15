"use client";

import { useState } from "react";
import {
  Title,
  Stack,
  Paper,
  TextInput,
  TagsInput,
  Select,
  Button,
  Group,
  Switch,
  Anchor,
  Alert,
  Accordion,
  Text,
  List,
  ActionIcon,
  SegmentedControl,
  Stepper,
  Badge,
  Table,
  Skeleton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconAlertTriangle,
  IconInfoCircle,
  IconChecklist,
  IconExternalLink,
  IconPlus,
  IconTrash,
  IconServer,
  IconArrowsExchange,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreateRestore, useSharedBackups, useCreateCrossClusterRestore } from "@/hooks/use-restores";
import { useBackups } from "@/hooks/use-backups";
import { useClusters } from "@/hooks/use-clusters";
import type { CrossClusterBackup } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface NamespaceMapping {
  source: string;
  target: string;
}

export default function CreateRestorePage() {
  const router = useRouter();
  const createMutation = useCreateRestore();
  const crossClusterMutation = useCreateCrossClusterRestore();
  const { data: backups } = useBackups();
  const { data: clusters } = useClusters();
  const { data: sharedBackups, isLoading: sharedLoading } = useSharedBackups();
  const [namespaceMappings, setNamespaceMappings] = useState<NamespaceMapping[]>([]);
  const [mode, setMode] = useState<string>("standard");

  // Cross-cluster state
  const [ccStep, setCcStep] = useState(0);
  const [ccSourceCluster, setCcSourceCluster] = useState<string>("");
  const [ccSelectedBackup, setCcSelectedBackup] = useState<CrossClusterBackup | null>(null);
  const [ccTargetCluster, setCcTargetCluster] = useState<string>("");

  const hasMultipleClusters = (clusters || []).length >= 2;
  const completedBackups = (backups || []).filter((b) => b.phase === "Completed");

  const form = useForm({
    initialValues: {
      name: "",
      backupName: "",
      includedNamespaces: [] as string[],
      excludedNamespaces: [] as string[],
      restorePVs: true,
      existingResourcePolicy: "none",
    },
  });

  // Cross-cluster config form
  const ccForm = useForm({
    initialValues: {
      name: "",
      includedNamespaces: [] as string[],
      excludedNamespaces: [] as string[],
      restorePVs: true,
      existingResourcePolicy: "none",
    },
  });

  const addNamespaceMapping = () => {
    setNamespaceMappings([...namespaceMappings, { source: "", target: "" }]);
  };

  const removeNamespaceMapping = (index: number) => {
    setNamespaceMappings(namespaceMappings.filter((_, i) => i !== index));
  };

  const updateNamespaceMapping = (index: number, field: "source" | "target", value: string) => {
    const updated = [...namespaceMappings];
    updated[index][field] = value;
    setNamespaceMappings(updated);
  };

  const handleSubmit = (values: typeof form.values) => {
    if (!values.backupName) {
      notifications.show({ title: "Error", message: "Backup is required", color: "red" });
      return;
    }

    const nsMapping: Record<string, string> = {};
    namespaceMappings.forEach((m) => {
      if (m.source && m.target) nsMapping[m.source] = m.target;
    });

    createMutation.mutate(
      {
        name: values.name || undefined,
        backupName: values.backupName,
        includedNamespaces:
          values.includedNamespaces.length > 0 ? values.includedNamespaces : undefined,
        excludedNamespaces:
          values.excludedNamespaces.length > 0 ? values.excludedNamespaces : undefined,
        restorePVs: values.restorePVs,
        existingResourcePolicy:
          values.existingResourcePolicy !== "none"
            ? (values.existingResourcePolicy as "update")
            : undefined,
        namespaceMapping: Object.keys(nsMapping).length > 0 ? nsMapping : undefined,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Restore created",
            message: "Restore initiated successfully",
            color: "green",
          });
          router.push("/restores");
        },
        onError: (err) => {
          notifications.show({
            title: "Failed to create restore",
            message: err.message,
            color: "red",
          });
        },
      }
    );
  };

  const handleCrossClusterSubmit = (values: typeof ccForm.values) => {
    if (!ccSelectedBackup || !ccSourceCluster || !ccTargetCluster) {
      notifications.show({ title: "Error", message: "Missing selection", color: "red" });
      return;
    }

    const nsMapping: Record<string, string> = {};
    namespaceMappings.forEach((m) => {
      if (m.source && m.target) nsMapping[m.source] = m.target;
    });

    crossClusterMutation.mutate(
      {
        sourceClusterId: ccSourceCluster,
        targetClusterId: ccTargetCluster,
        backupName: ccSelectedBackup.name,
        name: values.name || undefined,
        includedNamespaces:
          values.includedNamespaces.length > 0 ? values.includedNamespaces : undefined,
        excludedNamespaces:
          values.excludedNamespaces.length > 0 ? values.excludedNamespaces : undefined,
        restorePVs: values.restorePVs,
        existingResourcePolicy:
          values.existingResourcePolicy !== "none"
            ? (values.existingResourcePolicy as "update")
            : undefined,
        namespaceMapping: Object.keys(nsMapping).length > 0 ? nsMapping : undefined,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Cross-cluster restore created",
            message: `Restoring backup "${ccSelectedBackup.name}" to target cluster`,
            color: "green",
          });
          router.push("/restores");
        },
        onError: (err) => {
          notifications.show({
            title: "Failed to create cross-cluster restore",
            message: err.message,
            color: "red",
          });
        },
      }
    );
  };

  // Filter shared backups by source cluster
  const filteredSharedBackups = (sharedBackups || []).filter(
    (b) => b.sourceClusterId === ccSourceCluster
  );

  // Target clusters exclude the source
  const targetClusterOptions = (clusters || [])
    .filter((c) => c.id !== ccSourceCluster && c.status === "connected")
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <Stack>
      <Group>
        <Anchor component={Link} href="/restores" c="dimmed">
          <IconArrowLeft size={20} />
        </Anchor>
        <Title order={2}>Create Restore</Title>
      </Group>

      {/* Mode selector — only show when multiple clusters */}
      {hasMultipleClusters && (
        <SegmentedControl
          value={mode}
          onChange={setMode}
          data={[
            {
              value: "standard",
              label: (
                <Group gap={6}>
                  <IconServer size={16} />
                  <span>Standard Restore</span>
                </Group>
              ),
            },
            {
              value: "cross-cluster",
              label: (
                <Group gap={6}>
                  <IconArrowsExchange size={16} />
                  <span>Cross-Cluster Restore</span>
                </Group>
              ),
            },
          ]}
          style={{ maxWidth: 420 }}
        />
      )}

      {/* Best Practices Panel */}
      <Paper withBorder p="md" radius="md" maw={600}>
        <Accordion variant="separated">
          <Accordion.Item value="checklist">
            <Accordion.Control icon={<IconChecklist size={18} />}>
              Pre-Restore Checklist
            </Accordion.Control>
            <Accordion.Panel>
              <List spacing="xs" size="sm">
                <List.Item>
                  Verify Kubernetes version compatibility — target cluster must run an equal or
                  newer version than the backup source
                </List.Item>
                <List.Item>
                  By default, existing resources will NOT be overwritten — use the &quot;Existing
                  Resource Policy&quot; option below to change this behavior
                </List.Item>
                <List.Item>
                  Admission webhooks may reject restored resources — consider temporarily disabling
                  them if restore fails
                </List.Item>
                <List.Item>
                  CRDs must exist in the target cluster before restoring custom resources that
                  depend on them
                </List.Item>
                <List.Item>
                  Resources are restored in order: CRDs, Namespaces, StorageClasses, PVs, PVCs,
                  Secrets, ConfigMaps, ServiceAccounts, then Pods
                </List.Item>
                <List.Item>
                  <Text fw={600} span c="red.7">Important:</Text> If the target namespace already
                  contains PVCs/Pods, delete them before restoring. Velero skips existing PVCs and
                  even with the &quot;update&quot; policy, PV data is never overwritten — only
                  Kubernetes resource metadata is updated. For a clean restore, delete the target
                  namespace entirely or remove all PVCs and their mounting Pods first.
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="pv-limitations">
            <Accordion.Control icon={<IconAlertTriangle size={18} />}>
              PV/Snapshot Limitations
            </Accordion.Control>
            <Accordion.Panel>
              <List spacing="xs" size="sm">
                <List.Item>
                  Volume snapshots cannot be restored across cloud providers (e.g., AWS to GCP)
                </List.Item>
                <List.Item>
                  Cross-region snapshot restore may fail — snapshots must be copied to the target
                  region first
                </List.Item>
                <List.Item>
                  File System Backups (Restic/Kopia) are portable across providers and regions — use
                  them for cross-provider migrations
                </List.Item>
                <List.Item>
                  <Text fw={600} span c="red.7">PVC data is never restored when a PVC already
                  exists</Text>, even with the &quot;update&quot; policy — Velero only updates the
                  resource spec, not the volume data. Delete existing PVCs and their Pods before
                  restoring, or use namespace mapping to restore into a clean namespace
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="namespace-mapping">
            <Accordion.Control icon={<IconInfoCircle size={18} />}>
              Namespace Mapping
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm">
                Map source namespaces to different target namespaces. This is useful for restoring
                production backups into a staging environment, or for avoiding conflicts with
                existing resources. Configure mappings in the form below.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="resource-filtering">
            <Accordion.Control icon={<IconInfoCircle size={18} />}>
              Resource Filtering
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm">
                Use included/excluded namespaces and resource types to control what gets restored.
                If no namespaces are specified, ALL namespaces from the backup will be restored.
                Cluster-scoped resources are excluded when namespace filtering is used.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="docs">
            <Accordion.Control icon={<IconExternalLink size={18} />}>
              Velero Documentation
            </Accordion.Control>
            <Accordion.Panel>
              <List spacing="xs" size="sm">
                <List.Item>
                  <Anchor href="https://velero.io/docs/main/restore-reference/" target="_blank">
                    Restore Reference
                  </Anchor>
                </List.Item>
                <List.Item>
                  <Anchor href="https://velero.io/docs/main/resource-filtering/" target="_blank">
                    Resource Filtering
                  </Anchor>
                </List.Item>
                <List.Item>
                  <Anchor href="https://velero.io/docs/main/restore-hooks/" target="_blank">
                    Restore Hooks
                  </Anchor>
                </List.Item>
                <List.Item>
                  <Anchor href="https://velero.io/docs/main/restore-resource-modifiers/" target="_blank">
                    Resource Modifiers
                  </Anchor>
                </List.Item>
                <List.Item>
                  <Anchor href="https://velero.io/docs/main/migration-case/" target="_blank">
                    Cluster Migration Guide
                  </Anchor>
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Paper>

      {/* Standard Restore Form */}
      {mode === "standard" && (
        <Paper withBorder p="md" radius="md" maw={600}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <Select
                label="From Backup"
                placeholder="Select a completed backup"
                required
                searchable
                data={completedBackups.map((b) => ({ value: b.name, label: b.name }))}
                {...form.getInputProps("backupName")}
              />

              <TextInput
                label="Restore Name (optional)"
                placeholder="Auto-generated if empty"
                {...form.getInputProps("name")}
              />

              <TagsInput
                label="Included Namespaces"
                placeholder="Press Enter to add"
                description="Leave empty for all namespaces from backup"
                {...form.getInputProps("includedNamespaces")}
              />

              {form.values.includedNamespaces.length === 0 &&
                form.values.excludedNamespaces.length === 0 && (
                  <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                    No namespace filter specified — ALL namespaces from the backup will be restored.
                  </Alert>
                )}

              <TagsInput
                label="Excluded Namespaces"
                placeholder="Press Enter to add"
                {...form.getInputProps("excludedNamespaces")}
              />

              {form.values.excludedNamespaces.length > 0 && (
                <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
                  Excluding namespaces may leave dependent resources (like CRDs or cluster-scoped
                  resources) unrestored.
                </Alert>
              )}

              <Switch
                label="Restore Persistent Volumes"
                {...form.getInputProps("restorePVs", { type: "checkbox" })}
              />

              {form.values.restorePVs && (
                <Stack gap="xs">
                  <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
                    Volume snapshots are provider- and region-specific. Cross-provider or cross-region
                    restores may fail for snapshot-based PVs. Use File System Backup (Restic/Kopia) for
                    portable restores.
                  </Alert>
                  <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
                    If the target namespace already has PVCs, Velero will skip them — existing PV data
                    is NEVER overwritten, even with the &quot;update&quot; policy. For a full restore
                    with volumes, delete existing PVCs and their Pods first, or use Namespace Mapping
                    to restore into a clean namespace.
                  </Alert>
                </Stack>
              )}

              <Select
                label="Existing Resource Policy"
                description="How to handle resources that already exist in the target cluster"
                data={[
                  { value: "none", label: "Skip — Do not restore existing resources (default)" },
                  { value: "update", label: "Update — Overwrite existing resources" },
                ]}
                {...form.getInputProps("existingResourcePolicy")}
              />

              {form.values.existingResourcePolicy === "update" && (
                <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
                  Existing resources in the cluster WILL be overwritten. This can cause service
                  disruption. PVCs and Pods are not updated even with this policy.
                </Alert>
              )}

              {/* Namespace Mapping */}
              <Stack gap="xs">
                <Group justify="space-between">
                  <div>
                    <Text fw={500} size="sm">
                      Namespace Mapping
                    </Text>
                    <Text size="xs" c="dimmed">
                      Map source namespaces to different target namespaces
                    </Text>
                  </div>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={addNamespaceMapping}
                  >
                    Add
                  </Button>
                </Group>
                {namespaceMappings.map((mapping, index) => (
                  <Group key={index} gap="xs">
                    <TextInput
                      placeholder="Source namespace"
                      size="sm"
                      style={{ flex: 1 }}
                      value={mapping.source}
                      onChange={(e) => updateNamespaceMapping(index, "source", e.currentTarget.value)}
                    />
                    <Text size="sm" c="dimmed">
                      →
                    </Text>
                    <TextInput
                      placeholder="Target namespace"
                      size="sm"
                      style={{ flex: 1 }}
                      value={mapping.target}
                      onChange={(e) => updateNamespaceMapping(index, "target", e.currentTarget.value)}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => removeNamespaceMapping(index)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>

              <Group justify="flex-end">
                <Button variant="default" component={Link} href="/restores">
                  Cancel
                </Button>
                <Button type="submit" loading={createMutation.isPending}>
                  Create Restore
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      )}

      {/* Cross-Cluster Restore Stepper */}
      {mode === "cross-cluster" && (
        <Paper withBorder p="md" radius="md" maw={700}>
          <Stack>
            <Alert icon={<IconArrowsExchange size={16} />} color="indigo" variant="light">
              Cross-cluster restore uses shared Backup Storage Locations (BSLs) to restore a backup
              from one cluster onto another. Both clusters must have a BSL pointing to the same
              provider, bucket, and prefix.
            </Alert>

            <Stepper active={ccStep} onStepClick={setCcStep}>
              {/* Step 0: Source Cluster */}
              <Stepper.Step label="Source Cluster" description="Where the backup lives">
                <Stack mt="md">
                  <Select
                    label="Source Cluster"
                    placeholder="Select the cluster that owns the backup"
                    data={(clusters || [])
                      .filter((c) => c.status === "connected")
                      .map((c) => ({ value: c.id, label: c.name }))}
                    value={ccSourceCluster}
                    onChange={(v) => {
                      setCcSourceCluster(v || "");
                      setCcSelectedBackup(null);
                      setCcTargetCluster("");
                    }}
                    searchable
                  />
                  <Group justify="flex-end">
                    <Button
                      disabled={!ccSourceCluster}
                      onClick={() => setCcStep(1)}
                    >
                      Next
                    </Button>
                  </Group>
                </Stack>
              </Stepper.Step>

              {/* Step 1: Select Backup */}
              <Stepper.Step label="Select Backup" description="Pick a shared backup">
                <Stack mt="md">
                  {sharedLoading ? (
                    <Skeleton height={100} />
                  ) : filteredSharedBackups.length === 0 ? (
                    <Alert color="yellow" variant="light">
                      No shared backups found for this cluster. Ensure both clusters have Backup
                      Storage Locations pointing to the same storage (provider + bucket + prefix).
                    </Alert>
                  ) : (
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Backup</Table.Th>
                          <Table.Th>Storage Location</Table.Th>
                          <Table.Th>Items</Table.Th>
                          <Table.Th>Created</Table.Th>
                          <Table.Th></Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredSharedBackups.map((b) => (
                          <Table.Tr
                            key={b.name}
                            bg={ccSelectedBackup?.name === b.name ? "indigo.0" : undefined}
                            style={{ cursor: "pointer" }}
                            onClick={() => setCcSelectedBackup(b)}
                          >
                            <Table.Td fw={500}>{b.name}</Table.Td>
                            <Table.Td>{b.storageLocation}</Table.Td>
                            <Table.Td>
                              {b.itemsBackedUp}/{b.totalItems}
                            </Table.Td>
                            <Table.Td>{formatDate(b.created)}</Table.Td>
                            <Table.Td>
                              {ccSelectedBackup?.name === b.name && (
                                <Badge color="indigo" variant="light" size="sm">
                                  Selected
                                </Badge>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                  <Group justify="space-between">
                    <Button variant="default" onClick={() => setCcStep(0)}>
                      Back
                    </Button>
                    <Button
                      disabled={!ccSelectedBackup}
                      onClick={() => setCcStep(2)}
                    >
                      Next
                    </Button>
                  </Group>
                </Stack>
              </Stepper.Step>

              {/* Step 2: Target Cluster */}
              <Stepper.Step label="Target Cluster" description="Where to restore">
                <Stack mt="md">
                  <Select
                    label="Target Cluster"
                    placeholder="Select the cluster to restore into"
                    data={targetClusterOptions}
                    value={ccTargetCluster}
                    onChange={(v) => setCcTargetCluster(v || "")}
                    searchable
                  />

                  {ccSelectedBackup && ccTargetCluster && (
                    <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                      Backup &quot;{ccSelectedBackup.name}&quot; from cluster &quot;
                      {ccSelectedBackup.sourceClusterName}&quot; will be restored into the selected
                      target cluster via the shared Backup Storage Location.
                    </Alert>
                  )}

                  <Group justify="space-between">
                    <Button variant="default" onClick={() => setCcStep(1)}>
                      Back
                    </Button>
                    <Button
                      disabled={!ccTargetCluster}
                      onClick={() => setCcStep(3)}
                    >
                      Next
                    </Button>
                  </Group>
                </Stack>
              </Stepper.Step>

              {/* Step 3: Configure */}
              <Stepper.Step label="Configure" description="Restore options">
                <form onSubmit={ccForm.onSubmit(handleCrossClusterSubmit)}>
                  <Stack mt="md">
                    {ccSelectedBackup && (
                      <Alert icon={<IconArrowsExchange size={16} />} color="indigo" variant="light">
                        Restoring &quot;{ccSelectedBackup.name}&quot; from{" "}
                        {ccSelectedBackup.sourceClusterName} →{" "}
                        {(clusters || []).find((c) => c.id === ccTargetCluster)?.name || ccTargetCluster}
                      </Alert>
                    )}

                    <TextInput
                      label="Restore Name (optional)"
                      placeholder="Auto-generated if empty"
                      {...ccForm.getInputProps("name")}
                    />

                    <TagsInput
                      label="Included Namespaces"
                      placeholder="Press Enter to add"
                      description="Leave empty for all namespaces from backup"
                      {...ccForm.getInputProps("includedNamespaces")}
                    />

                    <TagsInput
                      label="Excluded Namespaces"
                      placeholder="Press Enter to add"
                      {...ccForm.getInputProps("excludedNamespaces")}
                    />

                    <Switch
                      label="Restore Persistent Volumes"
                      {...ccForm.getInputProps("restorePVs", { type: "checkbox" })}
                    />

                    {ccForm.values.restorePVs && (
                      <Stack gap="xs">
                        <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
                          Cross-cluster PV restores with snapshots may fail if clusters are in
                          different regions or providers. Use File System Backup for portability.
                        </Alert>
                        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
                          If the target namespace already has PVCs, Velero will skip them — existing
                          PV data is NEVER overwritten. Delete existing PVCs and Pods first, or use
                          Namespace Mapping to restore into a clean namespace.
                        </Alert>
                      </Stack>
                    )}

                    <Select
                      label="Existing Resource Policy"
                      description="How to handle resources that already exist in the target cluster"
                      data={[
                        { value: "none", label: "Skip — Do not restore existing resources (default)" },
                        { value: "update", label: "Update — Overwrite existing resources" },
                      ]}
                      {...ccForm.getInputProps("existingResourcePolicy")}
                    />

                    {ccForm.values.existingResourcePolicy === "update" && (
                      <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
                        Existing resources in the target cluster WILL be overwritten.
                      </Alert>
                    )}

                    {/* Namespace Mapping */}
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <div>
                          <Text fw={500} size="sm">
                            Namespace Mapping
                          </Text>
                          <Text size="xs" c="dimmed">
                            Map source namespaces to different target namespaces
                          </Text>
                        </div>
                        <Button
                          variant="light"
                          size="xs"
                          leftSection={<IconPlus size={14} />}
                          onClick={addNamespaceMapping}
                        >
                          Add
                        </Button>
                      </Group>
                      {namespaceMappings.map((mapping, index) => (
                        <Group key={index} gap="xs">
                          <TextInput
                            placeholder="Source namespace"
                            size="sm"
                            style={{ flex: 1 }}
                            value={mapping.source}
                            onChange={(e) =>
                              updateNamespaceMapping(index, "source", e.currentTarget.value)
                            }
                          />
                          <Text size="sm" c="dimmed">
                            →
                          </Text>
                          <TextInput
                            placeholder="Target namespace"
                            size="sm"
                            style={{ flex: 1 }}
                            value={mapping.target}
                            onChange={(e) =>
                              updateNamespaceMapping(index, "target", e.currentTarget.value)
                            }
                          />
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => removeNamespaceMapping(index)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      ))}
                    </Stack>

                    <Group justify="space-between">
                      <Button variant="default" onClick={() => setCcStep(2)}>
                        Back
                      </Button>
                      <Group>
                        <Button variant="default" component={Link} href="/restores">
                          Cancel
                        </Button>
                        <Button type="submit" loading={crossClusterMutation.isPending}>
                          Create Cross-Cluster Restore
                        </Button>
                      </Group>
                    </Group>
                  </Stack>
                </form>
              </Stepper.Step>
            </Stepper>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
