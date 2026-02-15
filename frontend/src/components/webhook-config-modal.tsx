"use client";

import {
  Modal,
  TextInput,
  Select,
  MultiSelect,
  Switch,
  Button,
  Stack,
  Group,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { useCreateWebhook, useUpdateWebhook } from "@/hooks/use-webhooks";
import type { WebhookConfig, WebhookType, NotificationEventType } from "@/lib/types";

const WEBHOOK_TYPES = [
  { value: "slack", label: "Slack" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "discord", label: "Discord" },
  { value: "webhook", label: "Generic Webhook" },
];

const EVENT_TYPES = [
  { value: "backup_failed", label: "Backup Failed" },
  { value: "backup_partially_failed", label: "Backup Partially Failed" },
  { value: "restore_failed", label: "Restore Failed" },
  { value: "bsl_unavailable", label: "BSL Unavailable" },
];

interface WebhookConfigModalProps {
  opened: boolean;
  onClose: () => void;
  webhook?: WebhookConfig | null;
}

export function WebhookConfigModal({ opened, onClose, webhook }: WebhookConfigModalProps) {
  const createMutation = useCreateWebhook();
  const updateMutation = useUpdateWebhook();
  const isEditing = !!webhook;

  const form = useForm({
    initialValues: {
      name: "",
      type: "slack" as string,
      url: "",
      events: [] as string[],
      enabled: true,
    },
    validate: {
      name: (v) => (!v ? "Name is required" : null),
      url: (v) => (!v ? "URL is required" : null),
      events: (v) => (v.length === 0 ? "Select at least one event" : null),
    },
  });

  useEffect(() => {
    if (webhook) {
      form.setValues({
        name: webhook.name,
        type: webhook.type,
        url: webhook.url,
        events: webhook.events as string[],
        enabled: webhook.enabled,
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhook, opened]);

  const handleSubmit = (values: typeof form.values) => {
    if (isEditing && webhook) {
      updateMutation.mutate(
        {
          id: webhook.id,
          data: {
            name: values.name,
            type: values.type as WebhookType,
            url: values.url,
            events: values.events as NotificationEventType[],
            enabled: values.enabled,
          },
        },
        {
          onSuccess: () => {
            notifications.show({ title: "Success", message: "Webhook updated", color: "green" });
            onClose();
          },
          onError: (err) => {
            notifications.show({ title: "Error", message: err.message, color: "red" });
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          name: values.name,
          type: values.type as WebhookType,
          url: values.url,
          events: values.events as NotificationEventType[],
          enabled: values.enabled,
        },
        {
          onSuccess: () => {
            notifications.show({ title: "Success", message: "Webhook created", color: "green" });
            onClose();
          },
          onError: (err) => {
            notifications.show({ title: "Error", message: err.message, color: "red" });
          },
        }
      );
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? "Edit Webhook" : "Add Webhook"}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label="Name"
            placeholder="e.g., Slack Alerts"
            required
            {...form.getInputProps("name")}
          />

          <Select
            label="Type"
            data={WEBHOOK_TYPES}
            required
            {...form.getInputProps("type")}
          />

          <TextInput
            label="Webhook URL"
            placeholder="https://hooks.slack.com/services/..."
            required
            {...form.getInputProps("url")}
          />

          <MultiSelect
            label="Events"
            description="Select which events trigger this webhook"
            data={EVENT_TYPES}
            required
            {...form.getInputProps("events")}
          />

          <Switch
            label="Enabled"
            {...form.getInputProps("enabled", { type: "checkbox" })}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? "Update" : "Create"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
