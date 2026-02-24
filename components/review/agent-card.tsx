"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentReviewResult } from "@/agents/schemas";

const agentLabels: Record<string, string> = {
  "code-reviewer": "Code Reviewer",
  security: "Security",
  performance: "Performance",
  testing: "Testing",
};

interface AgentCardProps {
  agentName: string;
  result?: AgentReviewResult;
  isLoading?: boolean;
}

export function AgentCard({ agentName, result, isLoading }: AgentCardProps) {
  const label = agentLabels[agentName] ?? agentName;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Analyzing...</p>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  if (result.error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  const r = result.result;
  if (!r) return null;

  const criticalCount = r.findings.filter(
    (f) => f.severity === "critical"
  ).length;
  const highCount = r.findings.filter((f) => f.severity === "high").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{label}</CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {criticalCount} critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {highCount} high
              </Badge>
            )}
            <Badge variant={r.score >= 7 ? "default" : "destructive"}>
              {r.score}/10
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">{r.summary}</p>
        <div className="space-y-3">
          {r.findings.map((f, i) => (
            <div key={i} className="border-l-2 border-muted pl-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    f.severity === "critical" || f.severity === "high"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-[10px]"
                >
                  {f.severity}
                </Badge>
                <span className="text-xs font-medium">{f.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {f.description}
              </p>
              <p className="mt-1 text-xs text-primary">
                Fix: {f.suggestion}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
