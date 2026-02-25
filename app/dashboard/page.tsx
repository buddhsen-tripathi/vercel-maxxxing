"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ChatInput } from "@/components/chat/chat-input";
import { CommitInput } from "@/components/chat/commit-input";
import { CodeBlock } from "@/components/review/code-block";
import { CommitInfo } from "@/components/review/commit-info";
import { ReviewPanel } from "@/components/review/review-panel";
import { useReview } from "@/hooks/use-review";
import type { AgentReviewResult } from "@/agents/schemas";
import type { CommitMeta } from "@/hooks/use-review";
import type { ChatMessage } from "@/hooks/use-follow-up-chat";
import { Code2, Shield, Gauge, TestTube2 } from "lucide-react";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("id");

  const [inputMode, setInputMode] = useState<"code" | "commit">("code");
  const [input, setInput] = useState("");
  const {
    results,
    agents,
    isReviewing,
    commitMeta,
    conversationId: liveConversationId,
    submitReview,
    submitCommitReview,
  } = useReview();
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [loadedResults, setLoadedResults] = useState<AgentReviewResult[]>([]);
  const [loadedCommitMeta, setLoadedCommitMeta] = useState<CommitMeta | null>(
    null
  );
  const [loadedFollowUpMessages, setLoadedFollowUpMessages] = useState<
    ChatMessage[]
  >([]);

  // Load existing conversation
  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/review/history?id=${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code) setSubmittedCode(data.code);
        if (data.results) setLoadedResults(data.results);
        if (data.commitMeta) setLoadedCommitMeta(data.commitMeta);
        if (data.followUpMessages) setLoadedFollowUpMessages(data.followUpMessages);
      })
      .catch(() => {});
  }, [conversationId]);

  const handleCodeSubmit = useCallback(() => {
    if (!input.trim() || isReviewing) return;
    setSubmittedCode(input);
    setLoadedResults([]);
    setLoadedCommitMeta(null);
    setLoadedFollowUpMessages([]);
    submitReview(input);
    setInput("");
  }, [input, isReviewing, submitReview]);

  const handleCommitSubmit = useCallback(
    (commitUrl: string) => {
      if (isReviewing) return;
      setSubmittedCode(null);
      setLoadedResults([]);
      setLoadedCommitMeta(null);
      setLoadedFollowUpMessages([]);
      submitCommitReview(commitUrl);
    },
    [isReviewing, submitCommitReview]
  );

  const displayResults = results.length > 0 ? results : loadedResults;
  const displayAgents =
    agents.length > 0 ? agents : displayResults.map((r) => r.agent);
  const displayCommitMeta = commitMeta ?? loadedCommitMeta;
  const activeConversationId = liveConversationId ?? conversationId;
  const hasResults = displayResults.length > 0 || isReviewing;

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden h-full md:flex">
        <div className="flex flex-[6] flex-col">
          {displayCommitMeta ? (
            <div className="flex-1 overflow-auto p-4">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Commit Review
              </h3>
              <CommitInfo commit={displayCommitMeta} />
            </div>
          ) : submittedCode ? (
            <div className="flex-1 overflow-auto p-4">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Submitted Code
              </h3>
              <CodeBlock code={submittedCode} />
            </div>
          ) : (
            <EmptyState />
          )}
          <InputArea
            mode={inputMode}
            onModeChange={setInputMode}
            codeValue={input}
            onCodeChange={setInput}
            onCodeSubmit={handleCodeSubmit}
            onCommitSubmit={handleCommitSubmit}
            disabled={isReviewing}
          />
        </div>
        <div className="flex-[4] border-l">
          <ReviewPanel
            agents={displayAgents}
            results={displayResults}
            isReviewing={isReviewing}
            conversationId={activeConversationId}
            followUpMessages={loadedFollowUpMessages}
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
            {displayCommitMeta ? (
              <div className="flex-1 overflow-auto p-4">
                <CommitInfo commit={displayCommitMeta} />
              </div>
            ) : submittedCode ? (
              <div className="flex-1 overflow-auto p-4">
                <CodeBlock code={submittedCode} />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <p className="text-sm">Paste code or enter a commit URL below</p>
              </div>
            )}
            <InputArea
              mode={inputMode}
              onModeChange={setInputMode}
              codeValue={input}
              onCodeChange={setInput}
              onCodeSubmit={handleCodeSubmit}
              onCommitSubmit={handleCommitSubmit}
              disabled={isReviewing}
            />
          </TabsContent>

          <TabsContent value="results" className="flex-1 overflow-hidden">
            <ReviewPanel
              agents={displayAgents}
              results={displayResults}
              isReviewing={isReviewing}
              conversationId={activeConversationId}
              followUpMessages={loadedFollowUpMessages}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function InputArea({
  mode,
  onModeChange,
  codeValue,
  onCodeChange,
  onCodeSubmit,
  onCommitSubmit,
  disabled,
}: {
  mode: "code" | "commit";
  onModeChange: (mode: "code" | "commit") => void;
  codeValue: string;
  onCodeChange: (v: string) => void;
  onCodeSubmit: () => void;
  onCommitSubmit: (url: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <Tabs
        value={mode}
        onValueChange={(v) => onModeChange(v as "code" | "commit")}
      >
        <TabsList className="mx-4 mt-2 mb-0">
          <TabsTrigger value="code">Paste Code</TabsTrigger>
          <TabsTrigger value="commit">Commit URL</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "code" ? (
        <ChatInput
          value={codeValue}
          onChange={onCodeChange}
          onSubmit={onCodeSubmit}
          disabled={disabled}
        />
      ) : (
        <CommitInput onSubmit={onCommitSubmit} disabled={disabled} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <div className="text-center max-w-sm">
        <div className="mb-6 flex justify-center gap-4">
          <Code2 className="h-8 w-8 animate-fade-in opacity-60" style={{ animationDelay: "0ms" }} />
          <Shield className="h-8 w-8 animate-fade-in opacity-60" style={{ animationDelay: "100ms" }} />
          <Gauge className="h-8 w-8 animate-fade-in opacity-60" style={{ animationDelay: "200ms" }} />
          <TestTube2 className="h-8 w-8 animate-fade-in opacity-60" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-xl font-medium text-foreground">Multi-Agent Code Review</p>
        <p className="mt-2 text-sm leading-relaxed">
          Paste code or enter a GitHub commit URL to get parallel analysis from
          4 specialized AI agents
        </p>
      </div>
    </div>
  );
}
