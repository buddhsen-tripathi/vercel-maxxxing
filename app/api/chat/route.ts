import { streamText, UIMessage, convertToModelMessages, gateway } from "ai";
import { codeReviewerSystemPrompt } from "@/agents/code-reviewer";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  chatLimiter,
  getRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { standaloneChatInputSchema } from "@/lib/validations";

export async function POST(req: Request) {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check
  const rl = chatLimiter(getRateLimitKey(req, session.user.id));
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  const raw = await req.json();
  const parsed = standaloneChatInputSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { messages } = raw as { messages: UIMessage[] };

  const result = streamText({
    model: gateway("openai/gpt-5-nano"),
    system: `${codeReviewerSystemPrompt}

Format your review as markdown with:
- A score out of 10
- A brief summary
- Findings grouped by severity (Critical, High, Medium, Low, Info)
- Each finding with: title, description, and suggested fix`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
