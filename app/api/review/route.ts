import { runMultiAgentReviewStreaming } from "@/agents/orchestrator";
import { auth } from "@/lib/auth";
import { createConversation, createMessage } from "@/lib/db/queries";
import {
  parseCommitInput,
  fetchCommitData,
  GitHubError,
  type CommitData,
} from "@/lib/github";
import type { AgentReviewResult } from "@/agents/schemas";
import { headers } from "next/headers";
import {
  reviewLimiter,
  getRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { reviewInputSchema } from "@/lib/validations";

export const maxDuration = 60;

export async function POST(req: Request) {
  const raw = await req.json();
  const parsed = reviewInputSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { code, commitUrl, conversationId } = parsed.data;

  // Get session (optional - don't block if no auth)
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    // Continue without auth
  }

  // Rate limit check
  const rlKey = getRateLimitKey(req, userId);
  const rl = reviewLimiter(rlKey);
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  // If commitUrl, fetch the commit diff
  let commitData: CommitData | null = null;
  let reviewInput: string;

  if (commitUrl?.trim()) {
    const parsed = parseCommitInput(commitUrl);
    if (!parsed) {
      return Response.json(
        { error: "Invalid commit URL format" },
        { status: 400 }
      );
    }

    try {
      commitData = await fetchCommitData(parsed.owner, parsed.repo, parsed.sha);
    } catch (err) {
      if (err instanceof GitHubError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      return Response.json({ error: "Failed to fetch commit" }, { status: 422 });
    }

    reviewInput = commitData.diff;
  } else {
    reviewInput = code!;
  }

  const encoder = new TextEncoder();
  const convId = conversationId ?? crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          )
        );
      }

      // Determine conversation title
      const title = commitData
        ? commitData.message.split("\n")[0].slice(0, 80)
        : reviewInput.slice(0, 80).replace(/\n/g, " ");

      // Build user message metadata (stores commit info for history)
      const userMeta = commitData
        ? JSON.stringify({
            commitMeta: {
              sha: commitData.sha,
              message: commitData.message,
              author: commitData.author,
              stats: commitData.stats,
              files: commitData.files.map((f) => ({
                filename: f.filename,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
              })),
              htmlUrl: commitData.htmlUrl,
              repoUrl: commitData.repoUrl,
            },
          })
        : undefined;

      // Create conversation in DB if user is authenticated
      if (userId) {
        try {
          await createConversation({ id: convId, title, userId });
          await createMessage({
            id: crypto.randomUUID(),
            conversationId: convId,
            role: "user",
            content: commitData ? commitData.diff : reviewInput,
            metadata: userMeta,
          });
        } catch {
          // Continue even if DB save fails
        }
      }

      sendEvent("conversation-id", { id: convId });

      // Send commit metadata event so UI can show CommitInfo
      if (commitData) {
        sendEvent("commit-metadata", {
          sha: commitData.sha,
          message: commitData.message,
          author: commitData.author,
          stats: commitData.stats,
          files: commitData.files.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
          })),
          htmlUrl: commitData.htmlUrl,
          repoUrl: commitData.repoUrl,
        });
      }

      sendEvent("agents-started", {
        agents: ["code-reviewer", "security", "performance", "testing"],
      });

      const allResults: AgentReviewResult[] = [];

      await runMultiAgentReviewStreaming(
        reviewInput,
        (result: AgentReviewResult) => {
          allResults.push(result);
          sendEvent("agent-result", result);
        }
      );

      // Save assistant response to DB
      if (userId) {
        try {
          await createMessage({
            id: crypto.randomUUID(),
            conversationId: convId,
            role: "assistant",
            content: "Multi-agent review complete",
            metadata: JSON.stringify(allResults),
          });
        } catch {
          // Continue even if DB save fails
        }
      }

      sendEvent("done", { message: "All agents complete" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
