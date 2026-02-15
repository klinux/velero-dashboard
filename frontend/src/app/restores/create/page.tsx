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
import { useCreateRestore } from "@/hooks/use-restores";
import { useBackups } from "@/hooks/use-backups";

export default function CreateRestorePage() {
  const router = useRouter();
  const createMutation = useCreateRestore();
  const { data: backups } = useBackups();

  const completedBackups = (backups || []).filter((b) => b.phase === "Completed");

  const form = useForm({
    initialValues: {
      name: "",
      backupName: "",
      includedNamespaces: [] as string[],
      excludedNamespaces: [] as string[],
      restorePVs: true,
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    if (!values.backupName) {
      notifications.show({ title: "Error", message: "Backup is required", color: "red" });
      return;
    }

    createMutation.mutate(
      {
        name: values.name || undefined,
        backupName: values.backupName,
        includedNamespaces:
          values.includedNamespaces.length > 0 ? values.includedNamespaces : undefined,
        excludedNamespaces:
          values.excludedNamespaces.length > 0 ? values.excludedNamespaces : undefined,
        restorePVs: values.restorePVs,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Restore created",
            message: "Restore initiated successfully",
            color: "green",
          });
          router.push("/restores");
        },
        onError: (err) => {
          notifications.show({ title: "Failed to create restore", message: err.message, color: "red" });
        },
      }
    );
  };

  return (
    <Stack>
      <Group>
        <Anchor component={Link} href="/restores" c="dimmed">
          <IconArrowLeft size={20} />
        </Anchor>
        <Title order={2}>Create Restore</Title>
      </Group>

      <Paper withBorder p="md" radius="md" maw={600}>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Select
              label="From Backup"
              placeholder="Select a completed backup"
              required
              searchable
              data={completedBackups.map((b) => ({ value: b.name, label: b.name }))}
              {...form.getInputProps("backupName")}
            />

            <TextInput
              label="Restore Name (optional)"
              placeholder="Auto-generated if empty"
              {...form.getInputProps("name")}
            />

            <TagsInput
              label="Included Namespaces"
              placeholder="Press Enter to add"
              description="Leave empty for all namespaces from backup"
              {...form.getInputProps("includedNamespaces")}
            />

            <TagsInput
              label="Excluded Namespaces"
              placeholder="Press Enter to add"
              {...form.getInputProps("excludedNamespaces")}
            />

            <Switch
              label="Restore Persistent Volumes"
              {...form.getInputProps("restorePVs", { type: "checkbox" })}
            />

            <Group justify="flex-end">
              <Button variant="default" component={Link} href="/restores">
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create Restore
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
