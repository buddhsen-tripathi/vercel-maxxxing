"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatInput } from "@/components/chat/chat-input";
import { CodeBlock } from "@/components/review/code-block";
import { ReviewPanel } from "@/components/review/review-panel";
import { useReview } from "@/hooks/use-review";
import type { AgentReviewResult } from "@/agents/schemas";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("id");

  const [input, setInput] = useState("");
  const { results, agents, isReviewing, submitReview } = useReview();
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [loadedResults, setLoadedResults] = useState<AgentReviewResult[]>([]);

  // Load existing conversation
  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/review/history?id=${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code) setSubmittedCode(data.code);
        if (data.results) setLoadedResults(data.results);
      })
      .catch(() => {});
  }, [conversationId]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isReviewing) return;
    setSubmittedCode(input);
    setLoadedResults([]);
    submitReview(input);
    setInput("");
  }, [input, isReviewing, submitReview]);

  const displayResults = results.length > 0 ? results : loadedResults;
  const displayAgents =
    agents.length > 0
      ? agents
      : displayResults.map((r) => r.agent);
  const hasResults = displayResults.length > 0 || isReviewing;

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden h-full md:flex">
        <div className="flex flex-[6] flex-col">
          {submittedCode ? (
            <div className="flex-1 overflow-auto p-4">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Submitted Code
              </h3>
              <CodeBlock code={submittedCode} />
            </div>
          ) : (
            <EmptyState />
          )}
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            disabled={isReviewing}
          />
        </div>
        <div className="flex-[4] border-l">
          <ReviewPanel
            agents={displayAgents}
            results={displayResults}
            isReviewing={isReviewing}
          />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col md:hidden">
        <Tabs
          defaultValue={hasResults ? "results" : "code"}
          className="flex flex-1 flex-col"
        >
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="results">
              Results
              {displayResults.length > 0 && ` (${displayResults.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="code"
            className="flex flex-1 flex-col overflow-hidden"
          >
            {submittedCode ? (
              <div className="flex-1 overflow-auto p-4">
                <CodeBlock code={submittedCode} />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <p className="text-sm">Paste code below</p>
              </div>
            )}
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              disabled={isReviewing}
            />
          </TabsContent>

          <TabsContent value="results" className="flex-1 overflow-hidden">
            <ReviewPanel
              agents={displayAgents}
              results={displayResults}
              isReviewing={isReviewing}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <div className="text-center">
        <p className="text-lg font-medium">Multi-Agent Code Review</p>
        <p className="mt-1 text-sm">
          Paste code below to get parallel analysis from 4 AI agents
        </p>
      </div>
    </div>
  );
}
