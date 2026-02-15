"use client";

import { Modal, TextInput, Select, Button, Stack, Group, Switch, Checkbox } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { CreateBackupStorageLocationRequest } from "@/lib/types";

interface CreateBSLModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: CreateBackupStorageLocationRequest) => Promise<void>;
}

export function CreateBSLModal({ opened, onClose, onSuccess, onSubmit }: CreateBSLModalProps) {
  const form = useForm<CreateBackupStorageLocationRequest>({
    initialValues: {
      name: "",
      provider: "aws",
      bucket: "",
      prefix: "",
      region: "",
      s3Url: "",
      s3ForcePathStyle: false,
      storageAccount: "",
      resourceGroup: "",
      subscriptionId: "",
      credential: "",
      default: false,
      accessMode: "ReadWrite",
    },
    validate: {
      name: (value) => (!value ? "Name is required" : null),
      provider: (value) => (!value ? "Provider is required" : null),
      bucket: (value) => (!value ? "Bucket is required" : null),
      region: (value, values) => {
        if ((values.provider === "aws" || values.provider === "velero.io/aws") && !value && !values.s3Url) {
          return "Region or S3 URL is required for AWS";
        }
        return null;
      },
      storageAccount: (value, values) => {
        if ((values.provider === "azure" || values.provider === "velero.io/azure") && !value) {
          return "Storage account is required for Azure";
        }
        return null;
      },
      resourceGroup: (value, values) => {
        if ((values.provider === "azure" || values.provider === "velero.io/azure") && !value) {
          return "Resource group is required for Azure";
        }
        return null;
      },
    },
  });

  const handleSubmit = async (values: CreateBackupStorageLocationRequest) => {
    try {
      await onSubmit(values);
      notifications.show({
        title: "Success",
        message: `Backup storage location "${values.name}" created successfully`,
        color: "green",
      });
      form.reset();
      onClose();
      onSuccess();
    } catch (error: unknown) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to create backup storage location",
        color: "red",
      });
    }
  };

  const provider = form.values.provider;
  const isAWS = provider === "aws" || provider === "velero.io/aws";
  const isGCP = provider === "gcp" || provider === "velero.io/gcp";
  const isAzure = provider === "azure" || provider === "velero.io/azure";

  return (
    <Modal opened={opened} onClose={onClose} title="Create Backup Storage Location" size="lg">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Common fields */}
          <TextInput
            label="Name"
            placeholder="my-backup-location"
            required
            {...form.getInputProps("name")}
          />

          <Select
            label="Provider"
            required
            data={[
              { value: "aws", label: "AWS S3" },
              { value: "velero.io/aws", label: "MinIO (S3-compatible)" },
              { value: "gcp", label: "Google Cloud Storage" },
              { value: "azure", label: "Azure Blob Storage" },
            ]}
            {...form.getInputProps("provider")}
          />

          <TextInput
            label="Bucket"
            placeholder="my-backup-bucket"
            required
            {...form.getInputProps("bucket")}
          />

          <TextInput
            label="Prefix (optional)"
            placeholder="velero/backups"
            {...form.getInputProps("prefix")}
          />

          {/* AWS/MinIO specific fields */}
          {isAWS && (
            <>
              <TextInput
                label="Region"
                placeholder="us-east-1"
                required={!form.values.s3Url}
                {...form.getInputProps("region")}
              />
              <TextInput
                label="S3 URL (MinIO only)"
                placeholder="http://minio.velero.svc:9000"
                description="Leave empty for AWS S3"
                {...form.getInputProps("s3Url")}
              />
              {form.values.s3Url && (
                <Checkbox
                  label="Force path style (required for MinIO)"
                  checked={form.values.s3ForcePathStyle}
                  onChange={(e) => form.setFieldValue("s3ForcePathStyle", e.currentTarget.checked)}
                />
              )}
            </>
          )}

          {/* GCP specific fields */}
          {isGCP && (
            <TextInput
              label="Region (optional)"
              placeholder="us-central1"
              {...form.getInputProps("region")}
            />
          )}

          {/* Azure specific fields */}
          {isAzure && (
            <>
              <TextInput
                label="Storage Account"
                placeholder="mystorageaccount"
                required
                {...form.getInputProps("storageAccount")}
              />
              <TextInput
                label="Resource Group"
                placeholder="my-resource-group"
                required
                {...form.getInputProps("resourceGroup")}
              />
              <TextInput
                label="Subscription ID (optional)"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                {...form.getInputProps("subscriptionId")}
              />
            </>
          )}

          {/* Common optional fields */}
          <TextInput
            label="Credential Secret Name"
            placeholder="cloud-credentials"
            description="Name of existing Kubernetes secret with cloud credentials"
            {...form.getInputProps("credential")}
          />

          <Select
            label="Access Mode"
            data={[
              { value: "ReadWrite", label: "Read/Write" },
              { value: "ReadOnly", label: "Read Only" },
            ]}
            {...form.getInputProps("accessMode")}
          />

          <Switch
            label="Set as default location"
            checked={form.values.default}
            onChange={(e) => form.setFieldValue("default", e.currentTarget.checked)}
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
