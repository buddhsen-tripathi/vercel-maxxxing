import { runMultiAgentReviewStreaming } from "@/agents/orchestrator";
import { auth } from "@/lib/auth";
import { createConversation, createMessage } from "@/lib/db/queries";
import type { AgentReviewResult } from "@/agents/schemas";
import { headers } from "next/headers";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { code, conversationId }: { code: string; conversationId?: string } =
    await req.json();

  if (!code?.trim()) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  // Get session (optional - don't block if no auth)
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    // Continue without auth
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

      // Create conversation in DB if user is authenticated
      if (userId) {
        try {
          await createConversation({
            id: convId,
            title: code.slice(0, 80).replace(/\n/g, " "),
            userId,
          });
          await createMessage({
            id: crypto.randomUUID(),
            conversationId: convId,
            role: "user",
            content: code,
          });
        } catch {
          // Continue even if DB save fails
        }
      }

      sendEvent("conversation-id", { id: convId });
      sendEvent("agents-started", {
        agents: ["code-reviewer", "security", "performance", "testing"],
      });

      const allResults: AgentReviewResult[] = [];

      await runMultiAgentReviewStreaming(
        code,
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
