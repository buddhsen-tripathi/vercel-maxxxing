"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium">
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
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
