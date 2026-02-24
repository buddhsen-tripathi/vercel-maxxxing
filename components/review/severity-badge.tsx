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
    className: "bg-red-600 text-white hover:bg-red-700",
  },
  high: {
    label: "High",
    className: "bg-orange-500 text-white hover:bg-orange-600",
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-500 text-black hover:bg-yellow-600",
  },
  low: {
    label: "Low",
    className: "bg-blue-500 text-white hover:bg-blue-600",
  },
  info: {
    label: "Info",
    className: "bg-gray-500 text-white hover:bg-gray-600",
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
