"use client";

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
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreateSchedule } from "@/hooks/use-schedules";
import { useBackupLocations } from "@/hooks/use-settings";
import { CronBuilder } from "@/components/cron-builder";

export default function CreateSchedulePage() {
  const router = useRouter();
  const createMutation = useCreateSchedule();
  const { data: locations } = useBackupLocations();

  const form = useForm({
    initialValues: {
      name: "",
      schedule: "",
      includedNamespaces: [] as string[],
      excludedNamespaces: [] as string[],
      storageLocation: "",
      ttl: "720h",
      snapshotVolumes: true,
      paused: false,
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    if (!values.name || !values.schedule) {
      notifications.show({
        title: "Error",
        message: "Name and cron schedule are required",
        color: "red",
      });
      return;
    }

    createMutation.mutate(
      {
        name: values.name,
        schedule: values.schedule,
        includedNamespaces:
          values.includedNamespaces.length > 0 ? values.includedNamespaces : undefined,
        excludedNamespaces:
          values.excludedNamespaces.length > 0 ? values.excludedNamespaces : undefined,
        storageLocation: values.storageLocation || undefined,
        ttl: values.ttl || undefined,
        snapshotVolumes: values.snapshotVolumes,
        paused: values.paused,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Schedule created",
            message: `Schedule "${values.name}" created successfully`,
            color: "green",
          });
          router.push("/schedules");
        },
        onError: (err) => {
          notifications.show({
            title: "Failed to create schedule",
            message: err.message,
            color: "red",
          });
        },
      }
    );
  };

  return (
    <Stack>
      <Group>
        <Anchor component={Link} href="/schedules" c="dimmed">
          <IconArrowLeft size={20} />
        </Anchor>
        <Title order={2}>Create Schedule</Title>
      </Group>

      <Paper withBorder p="md" radius="md" maw={600}>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Schedule Name"
              placeholder="daily-backup"
              required
              {...form.getInputProps("name")}
            />

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
              label="Start Paused"
              description="Create the schedule in paused state"
              {...form.getInputProps("paused", { type: "checkbox" })}
            />

            <Group justify="flex-end">
              <Button variant="default" component={Link} href="/schedules">
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create Schedule
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
