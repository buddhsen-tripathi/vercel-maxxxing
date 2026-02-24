import { auth } from "@/lib/auth";
import {
  getConversationById,
  getMessagesByConversation,
} from "@/lib/db/queries";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const conversation = await getConversationById(id);
  if (!conversation || conversation.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await getMessagesByConversation(id);

  // First user + assistant pair are the original review
  const userMessage = messages.find((m) => m.role === "user");
  const assistantMessage = messages.find((m) => m.role === "assistant");

  let results = null;
  if (assistantMessage?.metadata) {
    try {
      results = JSON.parse(assistantMessage.metadata);
    } catch {
      // Invalid JSON
    }
  }

  // Extract commit metadata from user message if present
  let commitMeta = null;
  if (userMessage?.metadata) {
    try {
      const parsed = JSON.parse(userMessage.metadata);
      commitMeta = parsed.commitMeta ?? null;
    } catch {
      // Invalid JSON
    }
  }

  // Follow-up messages: everything after the first user+assistant pair
  const followUpMessages: { id: string; role: string; content: string }[] = [];
  let skippedUser = false;
  let skippedAssistant = false;
  for (const msg of messages) {
    if (!skippedUser && msg.role === "user") {
      skippedUser = true;
      continue;
    }
    if (!skippedAssistant && msg.role === "assistant") {
      skippedAssistant = true;
      continue;
    }
    if (skippedUser && skippedAssistant) {
      followUpMessages.push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return Response.json({
    conversation,
    code: userMessage?.content ?? null,
    results,
    commitMeta,
    followUpMessages: followUpMessages.length > 0 ? followUpMessages : undefined,
  });
}
