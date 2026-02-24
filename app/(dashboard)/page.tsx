"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatInput } from "@/components/chat/chat-input";
import { CodeBlock } from "@/components/review/code-block";
import { ReviewPanel } from "@/components/review/review-panel";
import { useReview } from "@/hooks/use-review";

export default function DashboardPage() {
  const [input, setInput] = useState("");
  const { results, agents, isReviewing, submitReview } = useReview();
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isReviewing) return;
    setSubmittedCode(input);
    submitReview(input);
    setInput("");
  }, [input, isReviewing, submitReview]);

  const hasResults = results.length > 0 || isReviewing;

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
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">Multi-Agent Code Review</p>
                <p className="mt-1 text-sm">
                  Paste code below to get parallel analysis from 4 AI agents
                </p>
              </div>
            </div>
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
            agents={agents}
            results={results}
            isReviewing={isReviewing}
          />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col md:hidden">
        <Tabs defaultValue={hasResults ? "results" : "code"} className="flex flex-1 flex-col">
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="results">
              Results
              {results.length > 0 && ` (${results.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="flex flex-1 flex-col overflow-hidden">
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
              agents={agents}
              results={results}
              isReviewing={isReviewing}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
