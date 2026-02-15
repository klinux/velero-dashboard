import { Badge } from "@mantine/core";
import { phaseColor } from "@/lib/utils";

interface StatusBadgeProps {
  phase: string;
}

export function StatusBadge({ phase }: StatusBadgeProps) {
  return (
    <Badge color={phaseColor(phase)} variant="light" size="sm">
      {phase || "Unknown"}
    </Badge>
  );
}
