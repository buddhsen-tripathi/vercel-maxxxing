"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AgentCard } from "./agent-card";
import type { AgentReviewResult } from "@/agents/schemas";
import { BotMessageSquare } from "lucide-react";

const agentTabs: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "code-reviewer", label: "Code" },
  { value: "security", label: "Security" },
  { value: "performance", label: "Perf" },
  { value: "testing", label: "Testing" },
];

interface ReviewPanelProps {
  agents: string[];
  results: AgentReviewResult[];
  isReviewing: boolean;
}

export function ReviewPanel({
  agents,
  results,
  isReviewing,
}: ReviewPanelProps) {
  if (!isReviewing && results.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-muted-foreground">
        <BotMessageSquare className="h-10 w-10 opacity-40" />
        <p className="text-sm">Results will appear here after submitting code.</p>
      </div>
    );
  }

  // Aggregate counts
  const { totalFindings, criticalCount, highCount } = useMemo(() => {
    let total = 0;
    let critical = 0;
    let high = 0;
    for (const r of results) {
      for (const f of r.result?.findings ?? []) {
        total++;
        if (f.severity === "critical") critical++;
        else if (f.severity === "high") high++;
      }
    }
    return { totalFindings: total, criticalCount: critical, highCount: high };
  }, [results]);

  return (
    <div className="flex h-full flex-col">
      {/* Summary bar */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {totalFindings} findings
          </span>
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
          <span className="ml-auto text-xs text-muted-foreground">
            {results.length}/{agents.length} agents done
          </span>
        </div>
      )}

      <Tabs defaultValue="all" className="flex flex-1 flex-col">
        <TabsList className="mx-4 mt-2 w-auto">
          {agentTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              {agents.map((agentName) => {
                const result = results.find((r) => r.agent === agentName);
                return (
                  <AgentCard
                    key={agentName}
                    agentName={agentName}
                    result={result}
                    isLoading={isReviewing && !result}
                  />
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {agents.map((agentName) => (
          <TabsContent
            key={agentName}
            value={agentName}
            className="flex-1 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4">
                <AgentCard
                  agentName={agentName}
                  result={results.find((r) => r.agent === agentName)}
                  isLoading={
                    isReviewing && !results.find((r) => r.agent === agentName)
                  }
                />
              </div>
            </ScrollArea>
          </TabsContent>
        ))}

      </Tabs>
    </div>
  );
}
