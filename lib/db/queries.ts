import { eq, desc } from "drizzle-orm";
import { db } from ".";
import { conversation, message } from "./schema";

export async function getConversationsByUser(userId: string) {
  return db
    .select()
    .from(conversation)
    .where(eq(conversation.userId, userId))
    .orderBy(desc(conversation.createdAt));
}

export async function getConversationById(id: string) {
  const rows = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMessagesByConversation(conversationId: string) {
  return db
    .select()
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(message.createdAt);
}

export async function createConversation(data: {
  id: string;
  title: string | null;
  userId: string;
}) {
  const rows = await db.insert(conversation).values(data).returning();
  return rows[0];
}

export async function createMessage(data: {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  metadata?: string | null;
}) {
  const rows = await db.insert(message).values(data).returning();
  return rows[0];
}
