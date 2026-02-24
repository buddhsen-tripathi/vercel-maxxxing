"use client";

import { useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit]
  );

  return (
    <div className="flex gap-2 border-t p-4">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste your code here for review... (Cmd+Enter to submit)"
        className="min-h-[120px] resize-none font-mono text-sm"
        disabled={disabled}
      />
      <Button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="self-end"
      >
        {disabled ? "Reviewing..." : "Review"}
      </Button>
    </div>
  );
}
