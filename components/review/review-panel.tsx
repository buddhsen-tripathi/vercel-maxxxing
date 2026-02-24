"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentCard } from "./agent-card";
import type { AgentReviewResult } from "@/agents/schemas";

interface ReviewPanelProps {
  agents: string[];
  results: AgentReviewResult[];
  isReviewing: boolean;
}

export function ReviewPanel({ agents, results, isReviewing }: ReviewPanelProps) {
  if (!isReviewing && results.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Results will appear here after submitting code.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">Review Results</h3>
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
  );
}
