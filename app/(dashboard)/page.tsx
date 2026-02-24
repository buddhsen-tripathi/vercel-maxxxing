"use client";

import { useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";

const transport = new DefaultChatTransport({ api: "/api/chat" });

export default function DashboardPage() {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({ transport });

  const handleSubmit = useCallback(() => {
    if (!input.trim() || status !== "ready") return;
    sendMessage({ text: input });
    setInput("");
  }, [input, status, sendMessage]);

  return (
    <div className="flex h-full flex-col">
      <ChatMessages messages={messages} />
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={status !== "ready"}
      />
    </div>
  );
}
