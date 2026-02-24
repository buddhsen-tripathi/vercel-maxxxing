"use client";

import { useState, useCallback } from "react";
import { ChatInput } from "@/components/chat/chat-input";
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

  return (
    <div className="flex h-full">
      {/* Input Panel */}
      <div className="flex flex-1 flex-col">
        {submittedCode ? (
          <div className="flex-1 overflow-auto p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Submitted Code
            </h3>
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
              {submittedCode}
            </pre>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <p>Paste code below to start a multi-agent review</p>
          </div>
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isReviewing}
        />
      </div>

      {/* Results Panel */}
      <div className="w-[420px] border-l">
        <ReviewPanel
          agents={agents}
          results={results}
          isReviewing={isReviewing}
        />
      </div>
    </div>
  );
}
