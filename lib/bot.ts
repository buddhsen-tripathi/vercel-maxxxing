import { Chat, walkAst, isCodeNode } from "chat";
import { createDiscordAdapter } from "@chat-adapter/discord";
import { createMemoryState } from "@chat-adapter/state-memory";
import { runMultiAgentReview, formatDiscordSummary } from "@/agents/orchestrator";
import { parseCommitInput, fetchCommitData } from "@/lib/github";
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
import type { Content } from "mdast";

let _bot: Chat | null = null;

/**
 * Lazily initializes the Chat SDK bot instance.
 * Returns null if Discord env vars are not configured.
 */
export function getBot(): Chat | null {
  if (_bot) return _bot;

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!botToken || !publicKey) {
    return null;
  }

  _bot = new Chat({
    userName: process.env.BOT_USERNAME ?? "CodeReviewBot",
    adapters: {
      discord: createDiscordAdapter({
        botToken,
        publicKey,
        applicationId: process.env.DISCORD_APPLICATION_ID ?? "",
      }),
    },
    state: createMemoryState(),
  });

  // Handle @mentions with code blocks or GitHub commit URLs
  _bot.onNewMention(async (thread, message) => {
    const code =
      extractCodeFromFormatted(message.formatted) ??
      extractCodeFromText(message.text);
    const commitRef = extractCommitRef(message.text);

    if (!code && !commitRef) {
      await thread.post({
        markdown:
          "Please include a **code block** or a **GitHub commit URL** for me to review.\n\n" +
          "**Examples:**\n" +
          "````\n```js\nfunction add(a, b) { return a + b; }\n```\n````\n" +
          "or\n`https://github.com/owner/repo/commit/abc123`",
      });
      return;
    }

    await thread.startTyping();

    try {
      let reviewInput: string;

      if (commitRef) {
        const commitData = await fetchCommitData(
          commitRef.owner,
          commitRef.repo,
          commitRef.sha
        );
        const header = `Commit: ${commitData.sha.slice(0, 7)} — ${commitData.message.split("\n")[0]}\n\n`;
        reviewInput = header + commitData.diff;
      } else {
        reviewInput = code!;
      }

      const results = await runMultiAgentReview(reviewInput);
      const summary = formatDiscordSummary(results);
      await thread.post({ markdown: summary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await thread.post({
        markdown: `**Error running review:** ${msg}\n\nPlease try again.`,
      });
    }
  });

  // /summary slash command — posts the user's latest (or specific) review
  _bot.onSlashCommand("/summary", async (event) => {
    const convId = event.text.trim();

    try {
      let results;
      let title: string;

      if (convId) {
        // Fetch a specific review by conversation ID
        const conv = await getConversationById(convId);
        if (!conv) {
          await event.channel.post({
            markdown: `**Not found** — no review with ID \`${convId}\`.`,
          });
          return;
        }
        const messages = await getMessagesByConversation(convId);
        const assistantMsg = messages.find(
          (m) => m.role === "assistant" && m.metadata
        );
        if (!assistantMsg?.metadata) {
          await event.channel.post({
            markdown: "That conversation has no review results yet.",
          });
          return;
        }
        results = JSON.parse(assistantMsg.metadata);
        title = conv.title ?? `Review ${convId.slice(0, 8)}`;
      } else {
        // Try user-scoped review first, fall back to global
        const discordUserId = event.user.userId;
        let latest = null;

        if (discordUserId) {
          const userId = await getUserIdByDiscordId(discordUserId);
          if (userId) {
            latest = await getLatestReviewByUser(userId);
          }
        }

        if (!latest) {
          latest = await getLatestReview();
        }

        if (!latest) {
          await event.channel.post({
            markdown: "No reviews found. Submit a review on the web app first!",
          });
          return;
        }
        results = latest.results;
        title =
          latest.conversation.title ??
          `Review ${latest.conversation.id.slice(0, 8)}`;
      }

      const summary = formatDiscordSummary(results);
      await event.channel.post({
        markdown: `📋 **${title}**\n\n${summary}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await event.channel.post({
        markdown: `**Error fetching summary:** ${msg}`,
      });
    }
  });

  // /connect slash command — link Discord account with a 6-char code
  _bot.onSlashCommand("/connect", async (event) => {
    const code = event.text.trim().toUpperCase();
    const discordUserId = event.user.userId;
    const discordUsername = event.user.userName ?? "Unknown";

    if (!code) {
      await event.channel.post({
        markdown:
          "Please provide a link code: `/connect CODE`\n\nGet a code from **Settings** in the web app.",
      });
      return;
    }

    if (!discordUserId) {
      await event.channel.post({
        markdown: "**Error:** Could not identify your Discord account.",
      });
      return;
    }

    try {
      // Check if this Discord account is already linked
      const existingUserId = await getUserIdByDiscordId(discordUserId);
      if (existingUserId) {
        await event.channel.post({
          markdown:
            "Your Discord account is already linked. Use `/disconnect` first to re-link.",
        });
        return;
      }

      const link = await getDiscordLinkByCode(code);
      if (!link) {
        await event.channel.post({
          markdown:
            "**Invalid or expired code.** Generate a new one from Settings in the web app.",
        });
        return;
      }

      await confirmDiscordLink(link.id, discordUserId, discordUsername);
      await event.channel.post({
        markdown:
          "**Account linked!** `/summary` will now show your personal reviews.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await event.channel.post({
        markdown: `**Error linking account:** ${msg}`,
      });
    }
  });

  // /disconnect slash command — unlink Discord account
  _bot.onSlashCommand("/disconnect", async (event) => {
    const discordUserId = event.user.userId;

    if (!discordUserId) {
      await event.channel.post({
        markdown: "**Error:** Could not identify your Discord account.",
      });
      return;
    }

    try {
      const userId = await getUserIdByDiscordId(discordUserId);
      if (!userId) {
        await event.channel.post({
          markdown:
            "Your Discord account is not linked. Use `/connect CODE` to link it.",
        });
        return;
      }

      await deleteDiscordLink(userId);
      await event.channel.post({
        markdown:
          "**Account unlinked.** `/summary` will now show global reviews.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await event.channel.post({
        markdown: `**Error unlinking account:** ${msg}`,
      });
    }
  });

  return _bot;
}

/**
 * Extract fenced code blocks from a message's mdast AST.
 */
function extractCodeFromFormatted(
  formatted: { type: string; children?: Content[] }
): string | null {
  const codeBlocks: string[] = [];

  walkAst(formatted as Parameters<typeof walkAst>[0], (node) => {
    if (isCodeNode(node)) {
      codeBlocks.push(node.value);
    }
    return node;
  });

  return codeBlocks.length > 0 ? codeBlocks.join("\n\n") : null;
}

/**
 * Fallback: extract code blocks from plain text using regex.
 */
function extractCodeFromText(text: string): string | null {
  const matches = text.match(/```[\s\S]*?```/g);
  if (!matches || matches.length === 0) return null;

  return matches
    .map((block) => block.replace(/^```\w*\n?/, "").replace(/\n?```$/, ""))
    .join("\n\n");
}

/**
 * Extract a GitHub commit URL or owner/repo@sha shorthand from message text.
 * Returns null if no commit reference is found.
 */
function extractCommitRef(
  text: string
): { owner: string; repo: string; sha: string } | null {
  // Strip code blocks so we don't match URLs inside them
  const stripped = text.replace(/```[\s\S]*?```/g, "");
  const words = stripped.split(/\s+/);

  for (const word of words) {
    const parsed = parseCommitInput(word);
    if (parsed) return parsed;
  }

  return null;
}
