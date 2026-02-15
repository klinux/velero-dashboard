"use client";

import {
  Modal,
  Stack,
  TextInput,
  TagsInput,
  Select,
  Button,
  Group,
  Switch,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { CronBuilder } from "@/components/cron-builder";
import { useUpdateSchedule } from "@/hooks/use-schedules";
import { useBackupLocations } from "@/hooks/use-settings";
import type { Schedule } from "@/lib/types";

interface ScheduleEditModalProps {
  opened: boolean;
  onClose: () => void;
  schedule: Schedule | null;
}

export function ScheduleEditModal({ opened, onClose, schedule }: ScheduleEditModalProps) {
  const updateMutation = useUpdateSchedule();
  const { data: locations } = useBackupLocations();

  const form = useForm({
    initialValues: {
      schedule: "",
      includedNamespaces: [] as string[],
      excludedNamespaces: [] as string[],
      storageLocation: "",
      ttl: "",
      snapshotVolumes: true,
      paused: false,
    },
  });

  // Populate form when schedule changes
  useEffect(() => {
    if (schedule && opened) {
      form.setValues({
        schedule: schedule.schedule || "",
        includedNamespaces: schedule.includedNamespaces || [],
        excludedNamespaces: schedule.excludedNamespaces || [],
        storageLocation: schedule.storageLocation || "",
        ttl: schedule.ttl || "",
        snapshotVolumes: true,
        paused: schedule.paused,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, opened]);

  const handleSubmit = (values: typeof form.values) => {
    if (!schedule) return;
    if (!values.schedule) {
      notifications.show({
        title: "Error",
        message: "Cron schedule is required",
        color: "red",
      });
      return;
    }

    updateMutation.mutate(
      {
        name: schedule.name,
        data: {
          schedule: values.schedule,
          paused: values.paused,
          includedNamespaces:
            values.includedNamespaces.length > 0 ? values.includedNamespaces : undefined,
          excludedNamespaces:
            values.excludedNamespaces.length > 0 ? values.excludedNamespaces : undefined,
          storageLocation: values.storageLocation || undefined,
          ttl: values.ttl || undefined,
          snapshotVolumes: values.snapshotVolumes,
        },
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Schedule updated",
            message: `Schedule "${schedule.name}" updated successfully`,
            color: "green",
          });
          onClose();
        },
        onError: (err) => {
          notifications.show({
            title: "Failed to update schedule",
            message: err.message,
            color: "red",
          });
        },
      }
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Edit Schedule: ${schedule?.name || ""}`}
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <CronBuilder
            value={form.values.schedule}
            onChange={(value) => form.setFieldValue("schedule", value)}
            error={form.errors.schedule as string}
          />

          <Select
            label="Storage Location"
            placeholder="Default"
            data={(locations || []).map((l) => ({
              value: l.name,
              label: `${l.name} (${l.provider})`,
            }))}
            clearable
            {...form.getInputProps("storageLocation")}
          />

          <TagsInput
            label="Included Namespaces"
            placeholder="Press Enter to add"
            description="Leave empty for all namespaces"
            {...form.getInputProps("includedNamespaces")}
          />

          <TagsInput
            label="Excluded Namespaces"
            placeholder="Press Enter to add"
            {...form.getInputProps("excludedNamespaces")}
          />

          <TextInput
            label="TTL"
            placeholder="720h"
            description="Time to live for each backup"
            {...form.getInputProps("ttl")}
          />

          <Switch
            label="Snapshot Volumes"
            {...form.getInputProps("snapshotVolumes", { type: "checkbox" })}
          />

          <Switch
            label="Paused"
            description="Pause or resume the schedule"
            {...form.getInputProps("paused", { type: "checkbox" })}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
