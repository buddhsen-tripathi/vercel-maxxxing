"use client";

import { useState, useCallback, useRef } from "react";
import type { AgentReviewResult } from "@/agents/schemas";

export interface CommitMeta {
  sha: string;
  message: string;
  author: { name: string; login: string; avatarUrl: string; date: string };
  stats: { additions: number; deletions: number; total: number };
  files: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
  htmlUrl: string;
  repoUrl: string;
}

interface UseReviewReturn {
  results: AgentReviewResult[];
  agents: string[];
  isReviewing: boolean;
  commitMeta: CommitMeta | null;
  conversationId: string | null;
  submitReview: (code: string) => void;
  submitCommitReview: (commitUrl: string) => void;
}

export function useReview(): UseReviewReturn {
  const [results, setResults] = useState<AgentReviewResult[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [commitMeta, setCommitMeta] = useState<CommitMeta | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startReviewStream = useCallback(
    (body: Record<string, unknown>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setResults([]);
      setAgents([]);
      setIsReviewing(true);
      setCommitMeta(null);
      setConversationId(null);

      fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error ?? "Review request failed");
          }
          if (!response.body) throw new Error("No response body");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            let eventType = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7);
              } else if (line.startsWith("data: ")) {
                const data = JSON.parse(line.slice(6));
                if (eventType === "conversation-id") {
                  setConversationId(data.id);
                } else if (eventType === "agents-started") {
                  setAgents(data.agents);
                } else if (eventType === "agent-result") {
                  setResults((prev) => [...prev, data as AgentReviewResult]);
                } else if (eventType === "commit-metadata") {
                  setCommitMeta(data as CommitMeta);
                } else if (eventType === "done") {
                  setIsReviewing(false);
                }
                eventType = "";
              }
            }
          }

          setIsReviewing(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Review error:", err);
          }
          setIsReviewing(false);
        });
    },
    []
  );

  const submitReview = useCallback(
    (code: string) => startReviewStream({ code }),
    [startReviewStream]
  );

  const submitCommitReview = useCallback(
    (commitUrl: string) => startReviewStream({ commitUrl }),
    [startReviewStream]
  );

  return {
    results,
    agents,
    isReviewing,
    commitMeta,
    conversationId,
    submitReview,
    submitCommitReview,
  };
}
