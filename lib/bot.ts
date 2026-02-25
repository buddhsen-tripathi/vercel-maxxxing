import { Chat, walkAst, isCodeNode } from "chat";
import { createDiscordAdapter } from "@chat-adapter/discord";
import { createMemoryState } from "@chat-adapter/state-memory";
import { runMultiAgentReview, formatDiscordSummary } from "@/agents/orchestrator";
import { parseCommitInput, fetchCommitData } from "@/lib/github";
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
