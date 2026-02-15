import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export function formatDate(date?: string | null): string {
  if (!date) return "-";
  return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
}

export function timeAgo(date?: string | null): string {
  if (!date) return "-";
  return dayjs(date).fromNow();
}

export function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return "-";
  const diff = dayjs(end).diff(dayjs(start), "second");
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export function phaseColor(
  phase: string
): "green" | "red" | "yellow" | "blue" | "gray" | "orange" {
  switch (phase) {
    case "Completed":
    case "Available":
    case "Enabled":
      return "green";
    case "Failed":
      return "red";
    case "PartiallyFailed":
      return "orange";
    case "InProgress":
    case "New":
      return "blue";
    case "Deleting":
    case "WaitingForPluginOperations":
    case "Finalizing":
      return "yellow";
    default:
      return "gray";
  }
}
