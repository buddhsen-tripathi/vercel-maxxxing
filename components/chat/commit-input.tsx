"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CommitInputProps {
  onSubmit: (commitUrl: string) => void;
  disabled?: boolean;
}

export function CommitInput({ onSubmit, disabled }: CommitInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
    setValue("");
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="border-t p-4">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="GitHub commit URL or owner/repo@sha"
          disabled={disabled}
          className="font-mono text-sm"
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="shrink-0"
        >
          {disabled ? "Reviewing..." : "Review"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Examples: <code>facebook/react@abc1234</code> or{" "}
        <code>https://github.com/owner/repo/commit/sha</code>
      </p>
    </div>
  );
}
