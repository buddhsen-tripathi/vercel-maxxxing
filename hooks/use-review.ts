"use client";

import { useState, useCallback, useRef } from "react";
import type { AgentReviewResult } from "@/agents/schemas";

interface UseReviewReturn {
  results: AgentReviewResult[];
  agents: string[];
  isReviewing: boolean;
  submitReview: (code: string) => void;
}

export function useReview(): UseReviewReturn {
  const [results, setResults] = useState<AgentReviewResult[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const submitReview = useCallback((code: string) => {
    // Abort any existing request
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setResults([]);
    setAgents([]);
    setIsReviewing(true);

    fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          throw new Error("Review request failed");
        }

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
              if (eventType === "agents-started") {
                setAgents(data.agents);
              } else if (eventType === "agent-result") {
                setResults((prev) => [...prev, data as AgentReviewResult]);
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
  }, []);

  return { results, agents, isReviewing, submitReview };
}
