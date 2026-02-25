"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "./severity-badge";
import type { Finding } from "@/agents/schemas";

const borderColors: Record<string, string> = {
  critical: "border-l-severity-critical",
  high: "border-l-severity-high",
  medium: "border-l-severity-medium",
  low: "border-l-severity-low",
  info: "border-l-severity-info",
};

interface FindingItemProps {
  finding: Finding;
}

export function FindingItem({ finding }: FindingItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "w-full cursor-pointer border-l-3 pl-3 text-left transition-colors hover:bg-muted/50",
        borderColors[finding.severity]
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <span className="text-xs font-medium">{finding.title}</span>
        {finding.lineReference && (
          <span className="text-[10px] text-muted-foreground">
            {finding.lineReference}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {expanded ? "−" : "+"}
        </span>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5 pb-1">
          <p className="text-xs text-muted-foreground">{finding.description}</p>
          <div className="rounded bg-primary/5 px-2 py-1.5">
            <p className="text-xs">
              <span className="font-medium text-primary">Suggestion: </span>
              {finding.suggestion}
            </p>
          </div>
        </div>
      )}
    </button>
  );
}
