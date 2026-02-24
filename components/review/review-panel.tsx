"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AgentCard } from "./agent-card";
import { FollowUpChat } from "./follow-up-chat";
import type { AgentReviewResult } from "@/agents/schemas";
import type { ChatMessage } from "@/hooks/use-follow-up-chat";

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
  conversationId?: string | null;
  followUpMessages?: ChatMessage[];
}

export function ReviewPanel({
  agents,
  results,
  isReviewing,
  conversationId,
  followUpMessages,
}: ReviewPanelProps) {
  if (!isReviewing && results.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Results will appear here after submitting code.
      </div>
    );
  }

  // Aggregate counts
  const totalFindings = results.reduce(
    (acc, r) => acc + (r.result?.findings.length ?? 0),
    0
  );
  const criticalCount = results.reduce(
    (acc, r) =>
      acc +
      (r.result?.findings.filter((f) => f.severity === "critical").length ?? 0),
    0
  );
  const highCount = results.reduce(
    (acc, r) =>
      acc +
      (r.result?.findings.filter((f) => f.severity === "high").length ?? 0),
    0
  );

  return (
    <div className="flex h-full flex-col">
      {/* Summary bar */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {totalFindings} findings
          </span>
          {criticalCount > 0 && (
            <Badge className="bg-red-600 text-white text-[10px]">
              {criticalCount} critical
            </Badge>
          )}
          {highCount > 0 && (
            <Badge className="bg-orange-500 text-white text-[10px]">
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
          {conversationId && !isReviewing && (
            <TabsTrigger value="chat" className="text-xs">
              Chat
            </TabsTrigger>
          )}
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

        {conversationId && (
          <TabsContent value="chat" className="flex-1 overflow-hidden">
            <FollowUpChat
              conversationId={conversationId}
              initialMessages={followUpMessages}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
