"use client";

import { TextInput } from "@mantine/core";
import { IconSearch, IconX } from "@tabler/icons-react";

interface TableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TableSearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: TableSearchInputProps) {
  return (
    <TextInput
      placeholder={placeholder}
      leftSection={<IconSearch size={16} />}
      rightSection={
        value ? (
          <IconX
            size={16}
            style={{ cursor: "pointer" }}
            onClick={() => onChange("")}
          />
        ) : null
      }
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      variant="filled"
      style={{ maxWidth: 350 }}
    />
  );
}
