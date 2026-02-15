"use client";

import { Modal, TextInput, Button, Stack, Group } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import type { VolumeSnapshotLocation, UpdateVolumeSnapshotLocationRequest } from "@/lib/types";

interface EditVSLModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (name: string, data: UpdateVolumeSnapshotLocationRequest) => Promise<void>;
  vsl: VolumeSnapshotLocation | null;
}

export function EditVSLModal({ opened, onClose, onSuccess, onSubmit, vsl }: EditVSLModalProps) {
  const form = useForm<UpdateVolumeSnapshotLocationRequest>({
    initialValues: {
      credential: "",
    },
  });

  useEffect(() => {
    if (vsl) {
      form.setValues({
        credential: "",
      });
    }
  }, [vsl]);

  const handleSubmit = async (values: UpdateVolumeSnapshotLocationRequest) => {
    if (!vsl) return;

    try {
      await onSubmit(vsl.name, values);
      notifications.show({
        title: "Success",
        message: `Volume snapshot location "${vsl.name}" updated successfully`,
        color: "green",
      });
      form.reset();
      onClose();
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to update volume snapshot location",
        color: "red",
      });
    }
  };

  if (!vsl) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={`Edit: ${vsl.name}`} size="md">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Credential Secret Name"
            placeholder="cloud-credentials"
            description="Leave empty to keep existing credential"
            {...form.getInputProps("credential")}
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
