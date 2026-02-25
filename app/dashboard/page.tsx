"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/chat/chat-input";
import { CommitInput } from "@/components/chat/commit-input";
import { CodeBlock } from "@/components/review/code-block";
import { CommitInfo } from "@/components/review/commit-info";
import { ReviewPanel } from "@/components/review/review-panel";
import { useReview } from "@/hooks/use-review";
import { useFollowUpChat, type ChatMessage } from "@/hooks/use-follow-up-chat";
import type { AgentReviewResult } from "@/agents/schemas";
import type { CommitMeta } from "@/hooks/use-review";
import { cn } from "@/lib/utils";
import {
  Code2,
  Shield,
  Gauge,
  TestTube2,
  SendHorizontal,
  Loader2,
} from "lucide-react";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("id");

  const [inputMode, setInputMode] = useState<"code" | "commit" | "chat">(
    "code"
  );
  const [input, setInput] = useState("");
  const [chatInput, setChatInput] = useState("");
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

  const displayResults = results.length > 0 ? results : loadedResults;
  const displayAgents =
    agents.length > 0 ? agents : displayResults.map((r) => r.agent);
  const displayCommitMeta = commitMeta ?? loadedCommitMeta;
  const activeConversationId = liveConversationId ?? conversationId;
  const hasResults = displayResults.length > 0 || isReviewing;
  const reviewDone =
    !isReviewing && displayResults.length > 0 && !!activeConversationId;

  const {
    messages: followUpMessages,
    sendMessage,
    isStreaming,
    loadMessages,
  } = useFollowUpChat(activeConversationId);
  const initializedRef = useRef(false);

  // Load existing conversation
  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/review/history?id=${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code) setSubmittedCode(data.code);
        if (data.results) setLoadedResults(data.results);
        if (data.commitMeta) setLoadedCommitMeta(data.commitMeta);
        if (data.followUpMessages)
          setLoadedFollowUpMessages(data.followUpMessages);
      })
      .catch(() => {});
  }, [conversationId]);

  // Load saved follow-up messages once
  useEffect(() => {
    if (loadedFollowUpMessages.length > 0 && !initializedRef.current) {
      loadMessages(loadedFollowUpMessages);
      initializedRef.current = true;
    }
  }, [loadedFollowUpMessages, loadMessages]);

  // Auto-switch to chat mode when review finishes
  useEffect(() => {
    if (reviewDone) setInputMode("chat");
  }, [reviewDone]);

  const handleCodeSubmit = useCallback(() => {
    if (!input.trim() || isReviewing) return;
    setSubmittedCode(input);
    setLoadedResults([]);
    setLoadedCommitMeta(null);
    setLoadedFollowUpMessages([]);
    initializedRef.current = false;
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
      initializedRef.current = false;
      submitCommitReview(commitUrl);
    },
    [isReviewing, submitCommitReview]
  );

  const handleChatSubmit = useCallback(() => {
    if (!chatInput.trim() || isStreaming) return;
    sendMessage(chatInput);
    setChatInput("");
  }, [chatInput, isStreaming, sendMessage]);

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden h-full md:flex">
        <div className="flex flex-[6] flex-col">
          <div className="flex flex-1 flex-col overflow-auto">
            {displayCommitMeta ? (
              <div className="p-4">
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  Commit Review
                </h3>
                <CommitInfo commit={displayCommitMeta} />
              </div>
            ) : submittedCode ? (
              <div className="p-4">
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  Submitted Code
                </h3>
                <CodeBlock code={submittedCode} />
              </div>
            ) : (
              <EmptyState />
            )}
            {followUpMessages.length > 0 && (
              <ChatMessages messages={followUpMessages} />
            )}
          </div>
          <InputArea
            mode={inputMode}
            onModeChange={setInputMode}
            codeValue={input}
            onCodeChange={setInput}
            onCodeSubmit={handleCodeSubmit}
            onCommitSubmit={handleCommitSubmit}
            disabled={isReviewing}
            reviewDone={reviewDone}
            chatValue={chatInput}
            onChatChange={setChatInput}
            onChatSubmit={handleChatSubmit}
            isChatStreaming={isStreaming}
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
            <div className="flex-1 overflow-auto">
              {displayCommitMeta ? (
                <div className="p-4">
                  <CommitInfo commit={displayCommitMeta} />
                </div>
              ) : submittedCode ? (
                <div className="p-4">
                  <CodeBlock code={submittedCode} />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground">
                  <p className="text-sm">
                    Paste code or enter a commit URL below
                  </p>
                </div>
              )}
              {followUpMessages.length > 0 && (
                <ChatMessages messages={followUpMessages} />
              )}
            </div>
            <InputArea
              mode={inputMode}
              onModeChange={setInputMode}
              codeValue={input}
              onCodeChange={setInput}
              onCodeSubmit={handleCodeSubmit}
              onCommitSubmit={handleCommitSubmit}
              disabled={isReviewing}
              reviewDone={reviewDone}
              chatValue={chatInput}
              onChatChange={setChatInput}
              onChatSubmit={handleChatSubmit}
              isChatStreaming={isStreaming}
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

function ChatMessages({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="space-y-3 border-t px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">Follow-up</p>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "flex",
            msg.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            )}
          >
            {msg.role === "assistant" ? (
              msg.content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-background/50 [&_pre]:p-2 [&_code]:text-xs">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )
            ) : (
              msg.content
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
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
  reviewDone,
  chatValue,
  onChatChange,
  onChatSubmit,
  isChatStreaming,
}: {
  mode: "code" | "commit" | "chat";
  onModeChange: (mode: "code" | "commit" | "chat") => void;
  codeValue: string;
  onCodeChange: (v: string) => void;
  onCodeSubmit: () => void;
  onCommitSubmit: (url: string) => void;
  disabled: boolean;
  reviewDone: boolean;
  chatValue: string;
  onChatChange: (v: string) => void;
  onChatSubmit: () => void;
  isChatStreaming: boolean;
}) {
  return (
    <div>
      <Tabs
        value={mode}
        onValueChange={(v) => onModeChange(v as "code" | "commit" | "chat")}
      >
        <TabsList className="mx-4 mt-2 mb-0">
          {reviewDone && <TabsTrigger value="chat">Follow Up</TabsTrigger>}
          <TabsTrigger value="code">Paste Code</TabsTrigger>
          <TabsTrigger value="commit">Commit URL</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "chat" ? (
        <div className="flex gap-2 border-t p-4">
          <Input
            value={chatValue}
            onChange={(e) => onChatChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onChatSubmit();
              }
            }}
            placeholder="Ask about the review..."
            disabled={isChatStreaming}
            className="flex-1"
          />
          <Button
            onClick={onChatSubmit}
            size="icon"
            disabled={!chatValue.trim() || isChatStreaming}
          >
            {isChatStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : mode === "code" ? (
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
          <Code2
            className="h-8 w-8 animate-fade-in opacity-60"
            style={{ animationDelay: "0ms" }}
          />
          <Shield
            className="h-8 w-8 animate-fade-in opacity-60"
            style={{ animationDelay: "100ms" }}
          />
          <Gauge
            className="h-8 w-8 animate-fade-in opacity-60"
            style={{ animationDelay: "200ms" }}
          />
          <TestTube2
            className="h-8 w-8 animate-fade-in opacity-60"
            style={{ animationDelay: "300ms" }}
          />
        </div>
        <p className="text-xl font-medium text-foreground">
          Multi-Agent Code Review
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          Paste code or enter a GitHub commit URL to get parallel analysis from
          4 specialized AI agents
        </p>
      </div>
    </div>
  );
}
