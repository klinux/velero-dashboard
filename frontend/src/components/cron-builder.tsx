"use client";

import { useState, useEffect } from "react";
import {
  Stack,
  SegmentedControl,
  Group,
  Button,
  Select,
  TextInput,
  Text,
  Paper,
  Code,
} from "@mantine/core";
import { IconClock } from "@tabler/icons-react";

interface CronBuilderProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const PRESETS = [
  { label: "Every Hour", value: "0 * * * *", description: "At minute 0 of every hour" },
  { label: "Every 6 Hours", value: "0 */6 * * *", description: "Every 6 hours at minute 0" },
  { label: "Daily at 2 AM", value: "0 2 * * *", description: "Every day at 2:00 AM" },
  { label: "Daily at Midnight", value: "0 0 * * *", description: "Every day at midnight" },
  { label: "Weekly (Sunday)", value: "0 0 * * 0", description: "Every Sunday at midnight" },
  { label: "Monthly (1st)", value: "0 0 1 * *", description: "1st day of every month at midnight" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString(),
  label: i.toString().padStart(2, "0"),
}));

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: i.toString(),
  label: i.toString().padStart(2, "0"),
}));

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: (i + 1).toString(),
  label: (i + 1).toString(),
}));

const INTERVALS = [
  { value: "hourly", label: "Every X hours" },
  { value: "daily", label: "Daily at specific time" },
  { value: "weekly", label: "Weekly on specific day" },
  { value: "monthly", label: "Monthly on specific day" },
];

function describeCron(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return "Invalid cron expression";

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  // Check presets first
  const preset = PRESETS.find((p) => p.value === cron);
  if (preset) return preset.description;

  // Build description
  let desc = "Every";

  // Frequency
  if (hour.includes("*/")) {
    const interval = hour.replace("*/", "");
    desc += ` ${interval} hours`;
  } else if (dayOfWeek !== "*") {
    const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
    desc += ` ${day?.label || dayOfWeek}`;
  } else if (dayOfMonth !== "*") {
    desc += ` ${dayOfMonth}${getOrdinalSuffix(parseInt(dayOfMonth))} of the month`;
  } else {
    desc += " day";
  }

  // Time
  if (hour !== "*" && !hour.includes("*/")) {
    desc += ` at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  } else if (minute !== "*" && !minute.includes("*/")) {
    desc += ` at minute ${minute}`;
  }

  return desc;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function CronBuilder({ value, onChange, error }: CronBuilderProps) {
  const [mode, setMode] = useState<string>("preset");
  const [customType, setCustomType] = useState<string>("daily");
  const [customHour, setCustomHour] = useState<string>("2");
  const [customMinute, setCustomMinute] = useState<string>("0");
  const [customDayOfWeek, setCustomDayOfWeek] = useState<string>("0");
  const [customDayOfMonth, setCustomDayOfMonth] = useState<string>("1");
  const [customInterval, setCustomInterval] = useState<string>("6");

  // Update custom values when value changes externally
  useEffect(() => {
    if (value && mode === "manual") {
      const parts = value.split(" ");
      if (parts.length === 5) {
        setCustomMinute(parts[0] === "*" ? "0" : parts[0]);
        setCustomHour(parts[1] === "*" ? "2" : parts[1].replace("*/", ""));
      }
    }
  }, [value, mode]);

  const handlePresetClick = (preset: string) => {
    onChange(preset);
  };

  const handleCustomChange = () => {
    let cron = "";
    switch (customType) {
      case "hourly":
        cron = `${customMinute} */${customInterval} * * *`;
        break;
      case "daily":
        cron = `${customMinute} ${customHour} * * *`;
        break;
      case "weekly":
        cron = `${customMinute} ${customHour} * * ${customDayOfWeek}`;
        break;
      case "monthly":
        cron = `${customMinute} ${customHour} ${customDayOfMonth} * *`;
        break;
    }
    onChange(cron);
  };

  useEffect(() => {
    if (mode === "custom") {
      handleCustomChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customType, customHour, customMinute, customDayOfWeek, customDayOfMonth, customInterval, mode]);

  return (
    <Stack gap="md">
      <SegmentedControl
        value={mode}
        onChange={setMode}
        data={[
          { label: "Quick Presets", value: "preset" },
          { label: "Custom Builder", value: "custom" },
          { label: "Manual", value: "manual" },
        ]}
        fullWidth
      />

      {mode === "preset" && (
        <Group gap="xs">
          {PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant={value === preset.value ? "filled" : "light"}
              size="xs"
              onClick={() => handlePresetClick(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </Group>
      )}

      {mode === "custom" && (
        <Stack gap="sm">
          <Select
            label="Frequency"
            data={INTERVALS}
            value={customType}
            onChange={(v) => v && setCustomType(v)}
          />

          {customType === "hourly" && (
            <Group grow>
              <Select
                label="Every X hours"
                data={[
                  { value: "1", label: "1 hour" },
                  { value: "2", label: "2 hours" },
                  { value: "3", label: "3 hours" },
                  { value: "4", label: "4 hours" },
                  { value: "6", label: "6 hours" },
                  { value: "12", label: "12 hours" },
                ]}
                value={customInterval}
                onChange={(v) => v && setCustomInterval(v)}
              />
              <Select label="At minute" data={MINUTES} value={customMinute} onChange={(v) => v && setCustomMinute(v)} />
            </Group>
          )}

          {customType === "daily" && (
            <Group grow>
              <Select label="Hour" data={HOURS} value={customHour} onChange={(v) => v && setCustomHour(v)} />
              <Select label="Minute" data={MINUTES} value={customMinute} onChange={(v) => v && setCustomMinute(v)} />
            </Group>
          )}

          {customType === "weekly" && (
            <Stack gap="sm">
              <Select
                label="Day of week"
                data={DAYS_OF_WEEK}
                value={customDayOfWeek}
                onChange={(v) => v && setCustomDayOfWeek(v)}
              />
              <Group grow>
                <Select label="Hour" data={HOURS} value={customHour} onChange={(v) => v && setCustomHour(v)} />
                <Select label="Minute" data={MINUTES} value={customMinute} onChange={(v) => v && setCustomMinute(v)} />
              </Group>
            </Stack>
          )}

          {customType === "monthly" && (
            <Stack gap="sm">
              <Select
                label="Day of month"
                data={DAYS_OF_MONTH}
                value={customDayOfMonth}
                onChange={(v) => v && setCustomDayOfMonth(v)}
              />
              <Group grow>
                <Select label="Hour" data={HOURS} value={customHour} onChange={(v) => v && setCustomHour(v)} />
                <Select label="Minute" data={MINUTES} value={customMinute} onChange={(v) => v && setCustomMinute(v)} />
              </Group>
            </Stack>
          )}
        </Stack>
      )}

      {mode === "manual" && (
        <TextInput
          label="Cron Expression"
          placeholder="0 2 * * *"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          leftSection={<IconClock size={16} />}
          error={error}
          description={
            <>
              Format: <Code>minute hour day month weekday</Code>
            </>
          }
        />
      )}

      {/* Preview */}
      {value && (
        <Paper p="sm" withBorder>
          <Text size="xs" c="dimmed" mb={4}>
            Preview:
          </Text>
          <Group gap="xs">
            <Code>{value}</Code>
            <Text size="sm">=</Text>
            <Text size="sm" fw={500}>
              {describeCron(value)}
            </Text>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
