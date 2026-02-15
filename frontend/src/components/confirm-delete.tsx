"use client";

import { Button, Group, Modal, Text } from "@mantine/core";

interface ConfirmDeleteProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

export function ConfirmDelete({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  loading,
}: ConfirmDeleteProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text size="sm" mb="lg">
        {message}
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} loading={loading}>
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
