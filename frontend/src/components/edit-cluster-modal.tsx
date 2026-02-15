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
  Radio,
  PasswordInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconServer, IconUpload, IconKey } from "@tabler/icons-react";
import { useUpdateCluster } from "@/hooks/use-clusters";
import { notifications } from "@mantine/notifications";
import type { Cluster, UpdateClusterRequest } from "@/lib/types";

type AuthMode = "kubeconfig" | "token";

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
  const [authMode, setAuthMode] = useState<AuthMode>("kubeconfig");

  const form = useForm<UpdateClusterRequest>({
    initialValues: {
      name: "",
      namespace: "",
      setAsDefault: false,
      // Token auth fields
      apiServer: "",
      token: "",
      caCert: "",
      insecureSkipTLS: false,
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
      // Clean up the request based on auth mode — only send relevant credentials
      const requestData: UpdateClusterRequest = {
        name: values.name,
        namespace: values.namespace,
        setAsDefault: values.setAsDefault,
      };

      if (authMode === "kubeconfig") {
        // Only include kubeconfig if it was actually provided
        if (values.kubeconfig) {
          requestData.kubeconfig = values.kubeconfig;
        }
      } else {
        // Only include token fields if both apiServer and token are provided
        if (values.apiServer && values.token) {
          requestData.apiServer = values.apiServer;
          requestData.token = values.token;
          if (values.caCert) {
            requestData.caCert = values.caCert;
          }
          requestData.insecureSkipTLS = values.insecureSkipTLS;
        }
      }

      await updateCluster.mutateAsync({ id: cluster.id, data: requestData });
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

          <Radio.Group
            label="Update Credentials (Optional)"
            description="Choose how to update authentication. Leave fields empty to keep existing credentials."
            value={authMode}
            onChange={(value) => setAuthMode(value as AuthMode)}
          >
            <Group mt="xs">
              <Radio value="kubeconfig" label="Kubeconfig File" />
              <Radio value="token" label="Service Account Token" />
            </Group>
          </Radio.Group>

          {authMode === "kubeconfig" ? (
            <>
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
            </>
          ) : (
            <>
              <TextInput
                label="API Server URL"
                description="Kubernetes API server endpoint. Leave empty to keep existing."
                placeholder="https://api.cluster.example.com:6443"
                leftSection={<IconServer size={16} />}
                {...form.getInputProps("apiServer")}
              />

              <PasswordInput
                label="Bearer Token"
                description="Service account token for authentication. Leave empty to keep existing."
                placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
                leftSection={<IconKey size={16} />}
                {...form.getInputProps("token")}
              />

              <Textarea
                label="CA Certificate (Optional)"
                description="Base64-encoded CA certificate or PEM format"
                placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDDTCCAfWgAwIBAgIJANh...&#10;-----END CERTIFICATE-----"
                minRows={4}
                maxRows={8}
                {...form.getInputProps("caCert")}
              />

              <Checkbox
                label="Skip TLS Verification (Insecure)"
                description="Disable TLS certificate validation (not recommended for production)"
                {...form.getInputProps("insecureSkipTLS", { type: "checkbox" })}
              />
            </>
          )}

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
