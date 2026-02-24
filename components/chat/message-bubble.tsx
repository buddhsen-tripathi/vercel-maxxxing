"use client";

import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  const textContent =
    message.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") || "";

  return (
    <div className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          AI
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {textContent}
          </pre>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            {textContent}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
          You
        </div>
      )}
    </div>
  );
}
