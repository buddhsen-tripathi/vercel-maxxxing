"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Severity } from "@/agents/schemas";

const severityConfig: Record<
  Severity,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "bg-severity-critical text-severity-critical-foreground hover:bg-severity-critical/90",
  },
  high: {
    label: "High",
    className: "bg-severity-high text-severity-high-foreground hover:bg-severity-high/90",
  },
  medium: {
    label: "Medium",
    className: "bg-severity-medium text-severity-medium-foreground hover:bg-severity-medium/90",
  },
  low: {
    label: "Low",
    className: "bg-severity-low text-severity-low-foreground hover:bg-severity-low/90",
  },
  info: {
    label: "Info",
    className: "bg-severity-info text-severity-info-foreground hover:bg-severity-info/90",
  },
};

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  return (
    <Badge className={cn("text-[10px] font-semibold", config.className, className)}>
      {config.label}
    </Badge>
  );
}
