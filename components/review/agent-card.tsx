"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FindingItem } from "./finding-item";
import type { AgentReviewResult, AgentName } from "@/agents/schemas";
import { agentLabels } from "@/agents/constants";

interface AgentCardProps {
  agentName: string;
  result?: AgentReviewResult;
  isLoading?: boolean;
}

export function AgentCard({ agentName, result, isLoading }: AgentCardProps) {
  const config = agentLabels[agentName as AgentName] ?? {
    label: agentName,
    icon: "??",
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-[10px] font-bold">
              {config.icon}
            </div>
            <CardTitle className="text-sm">{config.label}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-2 w-3/4 rounded bg-muted" />
            <div className="h-2 w-1/2 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  if (result.error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-destructive/10 text-[10px] font-bold text-destructive">
              {config.icon}
            </div>
            <CardTitle className="text-sm">{config.label}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  const r = result.result;
  if (!r) return null;

  const scoreColor =
    r.score >= 7 ? "border-score-good text-score-good" : r.score >= 4 ? "border-score-ok text-score-ok" : "border-score-bad text-score-bad";

  const criticalCount = r.findings.filter((f) => f.severity === "critical").length;
  const highCount = r.findings.filter((f) => f.severity === "high").length;

  return (
    <Card className="animate-fade-in transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
              {config.icon}
            </div>
            <CardTitle className="text-sm">{config.label}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-severity-critical text-severity-critical-foreground text-[10px]">
                {criticalCount} critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="bg-severity-high text-severity-high-foreground text-[10px]">
                {highCount} high
              </Badge>
            )}
            <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${scoreColor}`}>
              <span className="text-sm font-bold">{r.score}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">{r.summary}</p>
        {r.findings.length > 0 && (
          <div className="space-y-2">
            {r.findings.map((f, i) => (
              <FindingItem key={`${f.severity}-${f.title}-${i}`} finding={f} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
