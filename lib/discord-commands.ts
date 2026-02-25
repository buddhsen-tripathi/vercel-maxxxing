import {
  getLatestReview,
  getLatestReviewByUser,
  getConversationById,
  getMessagesByConversation,
  getUserIdByDiscordId,
  getDiscordLinkByCode,
  confirmDiscordLink,
  deleteDiscordLink,
} from "@/lib/db/queries";
import { formatDiscordSummary } from "@/agents/orchestrator";

interface DiscordUser {
  id: string;
  username: string;
}

interface CommandContext {
  commandName: string;
  options: Record<string, string>;
  user: DiscordUser;
  token: string;
  applicationId: string;
}

const DISCORD_API = "https://discord.com/api/v10";

/** Send a follow-up message to a deferred interaction */
async function followUp(ctx: CommandContext, content: string) {
  await fetch(
    `${DISCORD_API}/webhooks/${ctx.applicationId}/${ctx.token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
}

export async function handleSlashCommand(ctx: CommandContext) {
  switch (ctx.commandName) {
    case "summary":
      return handleSummary(ctx);
    case "connect":
      return handleConnect(ctx);
    case "disconnect":
      return handleDisconnect(ctx);
    default:
      await followUp(ctx, "Unknown command.");
  }
}

async function handleSummary(ctx: CommandContext) {
  const convId = ctx.options.id;

  try {
    let results;
    let title: string;

    if (convId) {
      const conv = await getConversationById(convId);
      if (!conv) {
        await followUp(ctx, `**Not found** — no review with ID \`${convId}\`.`);
        return;
      }
      const messages = await getMessagesByConversation(convId);
      const assistantMsg = messages.find(
        (m) => m.role === "assistant" && m.metadata
      );
      if (!assistantMsg?.metadata) {
        await followUp(ctx, "That conversation has no review results yet.");
        return;
      }
      results = JSON.parse(assistantMsg.metadata);
      title = conv.title ?? `Review ${convId.slice(0, 8)}`;
    } else {
      const userId = await getUserIdByDiscordId(ctx.user.id);
      let latest = userId ? await getLatestReviewByUser(userId) : null;

      if (!latest) {
        latest = await getLatestReview();
      }

      if (!latest) {
        await followUp(
          ctx,
          "No reviews found. Submit a review on the web app first!"
        );
        return;
      }
      results = latest.results;
      title =
        latest.conversation.title ??
        `Review ${latest.conversation.id.slice(0, 8)}`;
    }

    const summary = formatDiscordSummary(results);
    await followUp(ctx, `📋 **${title}**\n\n${summary}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await followUp(ctx, `**Error fetching summary:** ${msg}`);
  }
}

async function handleConnect(ctx: CommandContext) {
  const code = (ctx.options.code ?? "").trim().toUpperCase();

  if (!code) {
    await followUp(
      ctx,
      "Please provide a link code: `/connect CODE`\n\nGet a code from **Settings** in the web app."
    );
    return;
  }

  try {
    const existingUserId = await getUserIdByDiscordId(ctx.user.id);
    if (existingUserId) {
      await followUp(
        ctx,
        "Your Discord account is already linked. Use `/disconnect` first to re-link."
      );
      return;
    }

    const link = await getDiscordLinkByCode(code);
    if (!link) {
      await followUp(
        ctx,
        "**Invalid or expired code.** Generate a new one from Settings in the web app."
      );
      return;
    }

    await confirmDiscordLink(link.id, ctx.user.id, ctx.user.username);
    await followUp(
      ctx,
      "**Account linked!** `/summary` will now show your personal reviews."
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await followUp(ctx, `**Error linking account:** ${msg}`);
  }
}

async function handleDisconnect(ctx: CommandContext) {
  try {
    const userId = await getUserIdByDiscordId(ctx.user.id);
    if (!userId) {
      await followUp(
        ctx,
        "Your Discord account is not linked. Use `/connect CODE` to link it."
      );
      return;
    }

    await deleteDiscordLink(userId);
    await followUp(
      ctx,
      "**Account unlinked.** `/summary` will now show global reviews."
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await followUp(ctx, `**Error unlinking account:** ${msg}`);
  }
}
