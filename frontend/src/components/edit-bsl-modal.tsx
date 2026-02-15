"use client";

import { Modal, TextInput, Select, Button, Stack, Group, Switch } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import type { BackupStorageLocation, UpdateBackupStorageLocationRequest } from "@/lib/types";

interface EditBSLModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (name: string, data: UpdateBackupStorageLocationRequest) => Promise<void>;
  bsl: BackupStorageLocation | null;
}

export function EditBSLModal({ opened, onClose, onSuccess, onSubmit, bsl }: EditBSLModalProps) {
  const form = useForm<UpdateBackupStorageLocationRequest>({
    initialValues: {
      accessMode: "ReadWrite",
      credential: "",
      default: false,
    },
  });

  useEffect(() => {
    if (bsl) {
      form.setValues({
        accessMode: bsl.accessMode || "ReadWrite",
        credential: "",
        default: bsl.default || false,
      });
    }
  }, [bsl]);

  const handleSubmit = async (values: UpdateBackupStorageLocationRequest) => {
    if (!bsl) return;

    try {
      await onSubmit(bsl.name, values);
      notifications.show({
        title: "Success",
        message: `Backup storage location "${bsl.name}" updated successfully`,
        color: "green",
      });
      form.reset();
      onClose();
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to update backup storage location",
        color: "red",
      });
    }
  };

  if (!bsl) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={`Edit: ${bsl.name}`} size="md">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            label="Access Mode"
            description="Controls read/write permissions"
            data={[
              { value: "ReadWrite", label: "Read/Write" },
              { value: "ReadOnly", label: "Read Only" },
            ]}
            {...form.getInputProps("accessMode")}
          />

          <TextInput
            label="Credential Secret Name"
            placeholder="cloud-credentials"
            description="Leave empty to keep existing credential"
            {...form.getInputProps("credential")}
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
            <Button type="submit">Save Changes</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
