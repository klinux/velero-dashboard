"use client";

import { Modal, TextInput, Select, Button, Stack, Group } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { CreateVolumeSnapshotLocationRequest } from "@/lib/types";

interface CreateVSLModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: CreateVolumeSnapshotLocationRequest) => Promise<void>;
}

export function CreateVSLModal({ opened, onClose, onSuccess, onSubmit }: CreateVSLModalProps) {
  const form = useForm<CreateVolumeSnapshotLocationRequest>({
    initialValues: {
      name: "",
      provider: "aws",
      region: "",
      resourceGroup: "",
      subscriptionId: "",
      credential: "",
    },
    validate: {
      name: (value) => (!value ? "Name is required" : null),
      provider: (value) => (!value ? "Provider is required" : null),
      region: (value, values) => {
        if ((values.provider === "aws" || values.provider === "velero.io/aws") && !value) {
          return "Region is required for AWS";
        }
        return null;
      },
    },
  });

  const handleSubmit = async (values: CreateVolumeSnapshotLocationRequest) => {
    try {
      await onSubmit(values);
      notifications.show({
        title: "Success",
        message: `Volume snapshot location "${values.name}" created successfully`,
        color: "green",
      });
      form.reset();
      onClose();
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to create volume snapshot location",
        color: "red",
      });
    }
  };

  const provider = form.values.provider;
  const isAWS = provider === "aws" || provider === "velero.io/aws";
  const isGCP = provider === "gcp" || provider === "velero.io/gcp";
  const isAzure = provider === "azure" || provider === "velero.io/azure";

  return (
    <Modal opened={opened} onClose={onClose} title="Create Volume Snapshot Location" size="lg">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Common fields */}
          <TextInput
            label="Name"
            placeholder="my-snapshot-location"
            required
            {...form.getInputProps("name")}
          />

          <Select
            label="Provider"
            required
            data={[
              { value: "aws", label: "AWS EBS" },
              { value: "gcp", label: "Google Cloud Persistent Disks" },
              { value: "azure", label: "Azure Managed Disks" },
            ]}
            {...form.getInputProps("provider")}
          />

          {/* AWS specific fields */}
          {isAWS && (
            <TextInput
              label="Region"
              placeholder="us-east-1"
              required
              {...form.getInputProps("region")}
            />
          )}

          {/* GCP specific - no specific required fields */}
          {isGCP && (
            <TextInput
              label="Project (optional)"
              placeholder="my-gcp-project"
              description="Leave empty to use the default project from credentials"
              {...form.getInputProps("config.project")}
            />
          )}

          {/* Azure specific fields */}
          {isAzure && (
            <>
              <TextInput
                label="Resource Group (optional)"
                placeholder="my-resource-group"
                {...form.getInputProps("resourceGroup")}
              />
              <TextInput
                label="Subscription ID (optional)"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                {...form.getInputProps("subscriptionId")}
              />
            </>
          )}

          {/* Common optional field */}
          <TextInput
            label="Credential Secret Name"
            placeholder="cloud-credentials"
            description="Name of existing Kubernetes secret with cloud credentials"
            {...form.getInputProps("credential")}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
