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

  return Response.json({
    conversation,
    code: userMessage?.content ?? null,
    results,
  });
}
