"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Checkbox,
  Button,
  Stack,
  Group,
  FileInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconServer, IconUpload } from "@tabler/icons-react";
import { useUpdateCluster } from "@/hooks/use-clusters";
import { notifications } from "@mantine/notifications";
import type { Cluster, UpdateClusterRequest } from "@/lib/types";

interface EditClusterModalProps {
  cluster: Cluster | null;
  opened: boolean;
  onClose: () => void;
}

export function EditClusterModal({
  cluster,
  opened,
  onClose,
}: EditClusterModalProps) {
  const updateCluster = useUpdateCluster();
  const [loading, setLoading] = useState(false);

  const form = useForm<UpdateClusterRequest>({
    initialValues: {
      name: "",
      namespace: "",
      setAsDefault: false,
    },
    validate: {
      name: (value) => {
        if (!value) return "Name is required";
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Name must contain only lowercase letters, numbers, and hyphens";
        }
        return null;
      },
      namespace: (value) => (!value ? "Namespace is required" : null),
    },
  });

  useEffect(() => {
    if (cluster) {
      form.setValues({
        name: cluster.name,
        namespace: cluster.namespace,
        setAsDefault: cluster.isDefault,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster]);

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    try {
      const text = await file.text();
      form.setFieldValue("kubeconfig", text);
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to read kubeconfig file",
        color: "red",
      });
    }
  };

  const handleSubmit = async (values: UpdateClusterRequest) => {
    if (!cluster) return;

    setLoading(true);
    try {
      await updateCluster.mutateAsync({ id: cluster.id, data: values });
      notifications.show({
        title: "Success",
        message: `Cluster ${values.name} updated successfully`,
        color: "green",
      });
      onClose();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to update cluster",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!cluster) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Edit Cluster" size="lg">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Cluster Name"
            description="Lowercase letters, numbers, and hyphens only"
            placeholder="production"
            leftSection={<IconServer size={16} />}
            required
            {...form.getInputProps("name")}
          />

          <TextInput
            label="Velero Namespace"
            description="Kubernetes namespace where Velero is installed"
            placeholder="velero"
            required
            {...form.getInputProps("namespace")}
          />

          <FileInput
            label="Update Kubeconfig (Optional)"
            description="Upload a new kubeconfig file or paste below. Leave empty to keep existing."
            placeholder="Click to upload"
            leftSection={<IconUpload size={16} />}
            accept=".yaml,.yml,.config"
            onChange={handleFileUpload}
          />

          <Textarea
            label="New Kubeconfig (Optional)"
            description="Paste new kubeconfig content. Leave empty to keep existing."
            placeholder="apiVersion: v1&#10;kind: Config&#10;clusters:&#10;..."
            minRows={8}
            maxRows={12}
            {...form.getInputProps("kubeconfig")}
          />

          <Checkbox
            label="Set as default cluster"
            description="This cluster will be selected automatically on login"
            {...form.getInputProps("setAsDefault", { type: "checkbox" })}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Update Cluster
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
