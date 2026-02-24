"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn("relative group rounded-lg border bg-muted", className)}>
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">
          {language ?? "code"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px]"
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-sm leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}
