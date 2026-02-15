"use client";

import { useState } from "react";
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
import { useCreateCluster } from "@/hooks/use-clusters";
import { notifications } from "@mantine/notifications";
import type { CreateClusterRequest } from "@/lib/types";

type AuthMode = "kubeconfig" | "token";

interface CreateClusterModalProps {
  opened: boolean;
  onClose: () => void;
}

export function CreateClusterModal({ opened, onClose }: CreateClusterModalProps) {
  const createCluster = useCreateCluster();
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("kubeconfig");

  const form = useForm<CreateClusterRequest>({
    initialValues: {
      name: "",
      kubeconfig: "",
      namespace: "velero",
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
      kubeconfig: (value) => {
        if (authMode === "kubeconfig" && !value) {
          return "Kubeconfig is required";
        }
        return null;
      },
      apiServer: (value) => {
        if (authMode === "token" && !value) {
          return "API Server URL is required";
        }
        return null;
      },
      token: (value) => {
        if (authMode === "token" && !value) {
          return "Token is required";
        }
        return null;
      },
      namespace: (value) => (!value ? "Namespace is required" : null),
    },
  });

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

  const handleSubmit = async (values: CreateClusterRequest) => {
    setLoading(true);
    try {
      // Clean up the request based on auth mode
      const requestData: CreateClusterRequest = {
        name: values.name,
        namespace: values.namespace,
        setAsDefault: values.setAsDefault,
      };

      if (authMode === "kubeconfig") {
        requestData.kubeconfig = values.kubeconfig;
      } else {
        requestData.apiServer = values.apiServer;
        requestData.token = values.token;
        if (values.caCert) {
          requestData.caCert = values.caCert;
        }
        requestData.insecureSkipTLS = values.insecureSkipTLS;
      }

      await createCluster.mutateAsync(requestData);
      notifications.show({
        title: "Success",
        message: `Cluster ${values.name} created successfully`,
        color: "green",
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to create cluster",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add New Cluster"
      size="lg"
    >
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
            label="Authentication Method"
            description="Choose how to authenticate with the Kubernetes cluster"
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
                label="Upload Kubeconfig"
                description="Upload your kubeconfig file (optional - you can paste below)"
                placeholder="Click to upload"
                leftSection={<IconUpload size={16} />}
                accept=".yaml,.yml,.config"
                onChange={handleFileUpload}
              />

              <Textarea
                label="Kubeconfig"
                description="Paste your kubeconfig content or upload a file above"
                placeholder="apiVersion: v1&#10;kind: Config&#10;clusters:&#10;..."
                required
                minRows={8}
                maxRows={12}
                {...form.getInputProps("kubeconfig")}
              />
            </>
          ) : (
            <>
              <TextInput
                label="API Server URL"
                description="Kubernetes API server endpoint (e.g., https://api.cluster.example.com:6443)"
                placeholder="https://api.cluster.example.com:6443"
                leftSection={<IconServer size={16} />}
                required
                {...form.getInputProps("apiServer")}
              />

              <PasswordInput
                label="Bearer Token"
                description="Service account token for authentication"
                placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
                leftSection={<IconKey size={16} />}
                required
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
              Add Cluster
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
