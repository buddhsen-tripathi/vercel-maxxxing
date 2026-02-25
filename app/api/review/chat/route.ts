import { streamText, convertToModelMessages, gateway } from "ai";
import { auth } from "@/lib/auth";
import {
  getConversationById,
  getMessagesByConversation,
  createMessage,
} from "@/lib/db/queries";
import { headers } from "next/headers";
import type { AgentReviewResult } from "@/agents/schemas";
import { formatReviewContext } from "@/agents/format";
import { chatLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { chatInputSchema } from "@/lib/validations";

export const maxDuration = 60;

export async function POST(req: Request) {
  const raw = await req.json();
  const parsed = chatInputSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { messages, conversationId } = parsed.data;

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check
  const rl = chatLimiter(`user:${session.user.id}`);
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  // Load conversation context from DB
  const conv = await getConversationById(conversationId);
  if (!conv || conv.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const dbMessages = await getMessagesByConversation(conversationId);
  const userMsg = dbMessages.find((m) => m.role === "user");
  const assistantMsg = dbMessages.find((m) => m.role === "assistant");

  const code = userMsg?.content ?? "";
  let reviewResults: AgentReviewResult[] = [];
  if (assistantMsg?.metadata) {
    try {
      reviewResults = JSON.parse(assistantMsg.metadata);
    } catch {
      // Invalid JSON
    }
  }

  const systemPrompt = `You are a helpful code review assistant. You have full context of a multi-agent code review that was just performed. Answer the user's follow-up questions about the review findings, explain issues in detail, suggest fixes, or discuss the code.

${formatReviewContext(code, reviewResults)}

Be concise but thorough. Use markdown formatting. When referencing findings, quote them precisely. When suggesting code fixes, use fenced code blocks.`;

  // Save the new user message to DB
  const latestUserMessage = messages[messages.length - 1];
  await createMessage({
    id: crypto.randomUUID(),
    conversationId,
    role: "user",
    content: latestUserMessage.content,
  });

  const result = streamText({
    model: gateway("openai/gpt-5-nano"),
    system: systemPrompt,
    messages: await convertToModelMessages(
      messages.map((m, i) => ({
        id: `msg-${i}`,
        role: m.role,
        parts: [{ type: "text" as const, text: m.content }],
      }))
    ),
    async onFinish({ text }) {
      await createMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: "assistant",
        content: text,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
