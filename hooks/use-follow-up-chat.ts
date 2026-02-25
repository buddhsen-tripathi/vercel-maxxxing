"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseFollowUpChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  isStreaming: boolean;
  loadMessages: (msgs: ChatMessage[]) => void;
}

export function useFollowUpChat(
  conversationId: string | null
): UseFollowUpChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (!conversationId || !text.trim() || isStreaming) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
      };

      const allMessages = [...messagesRef.current, userMsg];
      setMessages([...allMessages, assistantMsg]);
      setIsStreaming(true);

      fetch("/api/review/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          conversationId,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Chat request failed");
          if (!response.body) throw new Error("No response body");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Parse AI SDK UI message stream format
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (!line.startsWith("0:")) continue;
              try {
                const text = JSON.parse(line.slice(2));
                if (typeof text === "string") {
                  accumulated += text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: accumulated,
                      };
                    }
                    return updated;
                  });
                }
              } catch {
                // Skip non-text chunks
              }
            }
          }

          setIsStreaming(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Follow-up chat error:", err);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === "assistant" && !last.content) {
                updated[updated.length - 1] = {
                  ...last,
                  content: "Sorry, something went wrong. Please try again.",
                };
              }
              return updated;
            });
          }
          setIsStreaming(false);
        });
    },
    [conversationId, isStreaming]
  );

  return { messages, sendMessage, isStreaming, loadMessages };
}
