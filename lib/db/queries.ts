import { eq, desc, and, gt, isNotNull } from "drizzle-orm";
import { db } from ".";
import { conversation, message, discordLink } from "./schema";

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

/**
 * Fetches the most recent review that has agent results.
 * Returns the conversation + parsed AgentReviewResult[], or null.
 */
export async function getLatestReview() {
  const conversations = await db
    .select()
    .from(conversation)
    .orderBy(desc(conversation.createdAt))
    .limit(5);

  for (const conv of conversations) {
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, conv.id))
      .orderBy(message.createdAt);

    const assistantMsg = messages.find(
      (m) => m.role === "assistant" && m.metadata
    );
    if (!assistantMsg?.metadata) continue;

    try {
      const results = JSON.parse(assistantMsg.metadata);
      if (Array.isArray(results) && results.length > 0) {
        return { conversation: conv, results };
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ── Discord Link queries ─────────────────────────────────────────────

export async function getDiscordLinkByUser(userId: string) {
  const rows = await db
    .select()
    .from(discordLink)
    .where(eq(discordLink.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserIdByDiscordId(discordUserId: string) {
  const rows = await db
    .select({ userId: discordLink.userId })
    .from(discordLink)
    .where(
      and(
        eq(discordLink.discordUserId, discordUserId),
        isNotNull(discordLink.linkedAt)
      )
    )
    .limit(1);
  return rows[0]?.userId ?? null;
}

export async function getDiscordLinkByCode(code: string) {
  const rows = await db
    .select()
    .from(discordLink)
    .where(
      and(eq(discordLink.code, code), gt(discordLink.codeExpiresAt, new Date()))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createDiscordLink(data: {
  id: string;
  userId: string;
  code: string;
  codeExpiresAt: Date;
}) {
  const rows = await db.insert(discordLink).values(data).returning();
  return rows[0];
}

export async function confirmDiscordLink(
  id: string,
  discordUserId: string,
  discordUsername: string
) {
  const rows = await db
    .update(discordLink)
    .set({
      discordUserId,
      discordUsername,
      code: null,
      codeExpiresAt: null,
      linkedAt: new Date(),
    })
    .where(eq(discordLink.id, id))
    .returning();
  return rows[0];
}

export async function deleteDiscordLink(userId: string) {
  await db.delete(discordLink).where(eq(discordLink.userId, userId));
}

export async function getLatestReviewByUser(userId: string) {
  const conversations = await db
    .select()
    .from(conversation)
    .where(eq(conversation.userId, userId))
    .orderBy(desc(conversation.createdAt))
    .limit(5);

  for (const conv of conversations) {
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, conv.id))
      .orderBy(message.createdAt);

    const assistantMsg = messages.find(
      (m) => m.role === "assistant" && m.metadata
    );
    if (!assistantMsg?.metadata) continue;

    try {
      const results = JSON.parse(assistantMsg.metadata);
      if (Array.isArray(results) && results.length > 0) {
        return { conversation: conv, results };
      }
    } catch {
      continue;
    }
  }

  return null;
}
