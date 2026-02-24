"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import type { CommitFile } from "@/lib/github";

interface CommitMeta {
  sha: string;
  message: string;
  author: { name: string; login: string; avatarUrl: string; date: string };
  stats: { additions: number; deletions: number; total: number };
  files: CommitFile[];
  htmlUrl: string;
  repoUrl: string;
}

export function CommitInfo({ commit }: { commit: CommitMeta }) {
  const [open, setOpen] = useState(false);
  const [firstLine, ...restLines] = commit.message.split("\n");
  const restMessage = restLines.join("\n").trim();
  const relDate = formatRelativeDate(commit.author.date);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <Avatar size="sm">
          {commit.author.avatarUrl && (
            <AvatarImage src={commit.author.avatarUrl} alt={commit.author.name} />
          )}
          <AvatarFallback>{commit.author.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{commit.author.name}</p>
          <p className="text-xs text-muted-foreground">{relDate}</p>
        </div>
        <a
          href={commit.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-mono text-xs text-muted-foreground hover:underline"
        >
          {commit.sha.slice(0, 7)}
        </a>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-semibold">{firstLine}</p>
          {restMessage && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
              {restMessage}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-green-600">
            +{commit.stats.additions}
          </span>
          <span className="font-mono text-red-600">
            -{commit.stats.deletions}
          </span>
          <span className="text-muted-foreground">
            across {commit.files.length} file{commit.files.length !== 1 ? "s" : ""}
          </span>
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            {open ? "Hide" : "Show"} files
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 space-y-1">
              {commit.files.map((f) => (
                <li key={f.filename} className="flex items-center gap-2 text-xs">
                  <StatusBadge status={f.status} />
                  <span className="min-w-0 truncate font-mono">{f.filename}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    <span className="text-green-600">+{f.additions}</span>{" "}
                    <span className="text-red-600">-{f.deletions}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    added: { label: "A", variant: "default" },
    modified: { label: "M", variant: "secondary" },
    removed: { label: "D", variant: "destructive" },
    renamed: { label: "R", variant: "outline" },
  };
  const info = map[status] ?? { label: status.charAt(0).toUpperCase(), variant: "outline" as const };
  return (
    <Badge variant={info.variant} className="h-4 w-4 justify-center p-0 text-[10px]">
      {info.label}
    </Badge>
  );
}

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
