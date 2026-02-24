import { Chat, walkAst, isCodeNode } from "chat";
import { createDiscordAdapter } from "@chat-adapter/discord";
import { createMemoryState } from "@chat-adapter/state-memory";
import { runMultiAgentReview, formatDiscordSummary } from "@/agents/orchestrator";
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

  // Handle @mentions with code blocks
  _bot.onNewMention(async (thread, message) => {
    const code =
      extractCodeFromFormatted(message.formatted) ??
      extractCodeFromText(message.text);

    if (!code) {
      await thread.post({
        markdown:
          "Please include a code block (wrapped in \\`\\`\\`) for me to review.\n\n" +
          "**Example:**\n````\n```js\nfunction add(a, b) { return a + b; }\n```\n````",
      });
      return;
    }

    await thread.startTyping();

    try {
      const results = await runMultiAgentReview(code);
      const summary = formatDiscordSummary(results);
      await thread.post({ markdown: summary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await thread.post({
        markdown: `**Error running review:** ${msg}\n\nPlease try again.`,
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
