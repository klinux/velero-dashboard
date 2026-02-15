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
import { useCreateBackup } from "@/hooks/use-backups";
import { useBackupLocations } from "@/hooks/use-settings";

export default function CreateBackupPage() {
  const router = useRouter();
  const createMutation = useCreateBackup();
  const { data: locations } = useBackupLocations();

  const form = useForm({
    initialValues: {
      name: "",
      includedNamespaces: [] as string[],
      excludedNamespaces: [] as string[],
      storageLocation: "",
      ttl: "720h",
      snapshotVolumes: true,
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    if (!values.name) {
      notifications.show({ title: "Error", message: "Backup name is required", color: "red" });
      return;
    }

    createMutation.mutate(
      {
        name: values.name,
        includedNamespaces:
          values.includedNamespaces.length > 0 ? values.includedNamespaces : undefined,
        excludedNamespaces:
          values.excludedNamespaces.length > 0 ? values.excludedNamespaces : undefined,
        storageLocation: values.storageLocation || undefined,
        ttl: values.ttl || undefined,
        snapshotVolumes: values.snapshotVolumes,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Backup created",
            message: `Backup "${values.name}" created successfully`,
            color: "green",
          });
          router.push("/backups");
        },
        onError: (err) => {
          notifications.show({ title: "Failed to create backup", message: err.message, color: "red" });
        },
      }
    );
  };

  return (
    <Stack>
      <Group>
        <Anchor component={Link} href="/backups" c="dimmed">
          <IconArrowLeft size={20} />
        </Anchor>
        <Title order={2}>Create Backup</Title>
      </Group>

      <Paper withBorder p="md" radius="md" maw={600}>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Backup Name"
              placeholder="my-backup"
              required
              {...form.getInputProps("name")}
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
              description="Time to live for the backup"
              {...form.getInputProps("ttl")}
            />

            <Switch
              label="Snapshot Volumes"
              description="Take snapshots of persistent volumes"
              {...form.getInputProps("snapshotVolumes", { type: "checkbox" })}
            />

            <Group justify="flex-end">
              <Button variant="default" component={Link} href="/backups">
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create Backup
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
