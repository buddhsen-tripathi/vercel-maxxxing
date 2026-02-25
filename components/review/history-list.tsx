"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, ChevronRight } from "lucide-react";

interface Conversation {
  id: string;
  title: string | null;
  createdAt: Date;
}

interface HistoryListProps {
  conversations: Conversation[];
}

export function HistoryList({ conversations }: HistoryListProps) {
  return (
    <div className="space-y-3">
      {conversations.map((conv) => (
        <Link key={conv.id} href={`/dashboard?id=${conv.id}`}>
          <Card className="group transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center gap-3 py-4">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-sm font-medium">
                  {conv.title ?? "Untitled Review"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {new Date(conv.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </CardDescription>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
