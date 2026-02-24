import { runMultiAgentReviewStreaming } from "@/agents/orchestrator";
import type { AgentReviewResult } from "@/agents/schemas";

export async function POST(req: Request) {
  const { code }: { code: string } = await req.json();

  if (!code?.trim()) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      // Signal that all agents are starting
      sendEvent("agents-started", {
        agents: ["code-reviewer", "security", "performance", "testing"],
      });

      await runMultiAgentReviewStreaming(code, (result: AgentReviewResult) => {
        sendEvent("agent-result", result);
      });

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
