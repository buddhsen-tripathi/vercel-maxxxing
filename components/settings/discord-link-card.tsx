"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Loader2, Unlink, Link2 } from "lucide-react";

type LinkStatus =
  | { status: "none" }
  | { status: "pending"; code: string; expiresAt: string }
  | { status: "linked"; discordUsername: string; linkedAt: string };

export function DiscordLinkCard() {
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/discord/link");
      const data = await res.json();
      setLinkStatus(data);
      return data as LinkStatus;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll every 5s while pending
  useEffect(() => {
    if (linkStatus?.status === "pending") {
      pollRef.current = setInterval(async () => {
        const data = await fetchStatus();
        if (data && data.status !== "pending") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [linkStatus?.status, fetchStatus]);

  const handleGenerateCode = async () => {
    setActing(true);
    try {
      const res = await fetch("/api/discord/link", { method: "POST" });
      const data = await res.json();
      if (res.ok) setLinkStatus(data);
    } finally {
      setActing(false);
    }
  };

  const handleUnlink = async () => {
    setActing(true);
    try {
      const res = await fetch("/api/discord/link", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) setLinkStatus(data);
    } finally {
      setActing(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discord</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Discord
          {linkStatus?.status === "linked" && (
            <Badge variant="secondary">Linked</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Link your Discord account so <code>/summary</code> shows your personal
          reviews.{" "}
          <a
            href="https://discord.com/oauth2/authorize?client_id=1475996370224545914&scope=bot+applications.commands"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Add bot to your server
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linkStatus?.status === "none" && (
          <Button onClick={handleGenerateCode} disabled={acting}>
            {acting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Link Discord Account
          </Button>
        )}

        {linkStatus?.status === "pending" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Type this command in Discord:
            </p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-3 py-2 text-lg font-mono font-bold tracking-widest">
                /connect {linkStatus.code}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(linkStatus.code)}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Code expires in 10 minutes. Waiting for confirmation...
              <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />
            </p>
          </div>
        )}

        {linkStatus?.status === "linked" && (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {linkStatus.discordUsername}
              </p>
              <p className="text-xs text-muted-foreground">
                Linked{" "}
                {new Date(linkStatus.linkedAt).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" onClick={handleUnlink} disabled={acting}>
              {acting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="mr-2 h-4 w-4" />
              )}
              Unlink
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
