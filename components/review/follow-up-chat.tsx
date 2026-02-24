"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizontal, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFollowUpChat,
  type ChatMessage,
} from "@/hooks/use-follow-up-chat";

interface FollowUpChatProps {
  conversationId: string | null;
  initialMessages?: ChatMessage[];
}

export function FollowUpChat({
  conversationId,
  initialMessages,
}: FollowUpChatProps) {
  const { messages, sendMessage, isStreaming, loadMessages } =
    useFollowUpChat(conversationId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Load initial messages once
  useEffect(() => {
    if (initialMessages?.length && !initialized.current) {
      loadMessages(initialMessages);
      initialized.current = true;
    }
  }, [initialMessages, loadMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <MessageCircle className="h-8 w-8" />
              <p className="text-sm">Ask a follow-up question about the review</p>
            </div>
          )}
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
        </div>
      </ScrollArea>
      <div className="border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the review..."
            disabled={isStreaming || !conversationId}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming || !conversationId}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
