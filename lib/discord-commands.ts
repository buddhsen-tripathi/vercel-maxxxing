import {
  getLatestReview,
  getLatestReviewByUser,
  getConversationById,
  getMessagesByConversation,
  getUserIdByDiscordId,
  getDiscordLinkByCode,
  confirmDiscordLink,
  deleteDiscordLink,
  createConversation,
  createMessage,
} from "@/lib/db/queries";
import {
  formatDiscordSummary,
  runMultiAgentReview,
} from "@/agents/orchestrator";
import { formatReviewContext } from "@/agents/format";
import { parseCommitInput, fetchCommitData } from "@/lib/github";
import { generateText, gateway } from "ai";
import type { AgentReviewResult } from "@/agents/schemas";

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
const REVIEW_TIMEOUT_MS = 120_000; // 120s — leave buffer before 300s function limit

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

/** Send a follow-up message to a deferred interaction */
async function followUp(ctx: CommandContext, content: string) {
  // Discord enforces a 2000-char limit on message content
  const truncated =
    content.length > 1990
      ? content.slice(0, 1990) + "\n…(truncated)"
      : content;

  console.log(`[discord] followUp: sending ${truncated.length} chars to Discord API...`);

  const res = await fetch(
    `${DISCORD_API}/webhooks/${ctx.applicationId}/${ctx.token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: truncated }),
    }
  );

  if (res.ok) {
    console.log(`[discord] followUp: success (${res.status})`);
  } else {
    const body = await res.text().catch(() => "");
    console.error(`[discord] followUp: FAILED ${res.status} — ${body}`);
  }
}

export async function handleSlashCommand(ctx: CommandContext) {
  console.log(`[discord] handleSlashCommand: /${ctx.commandName}`, {
    options: ctx.options,
    user: ctx.user.username,
  });
  switch (ctx.commandName) {
    case "summary":
      return handleSummary(ctx);
    case "connect":
      return handleConnect(ctx);
    case "disconnect":
      return handleDisconnect(ctx);
    case "review":
      return handleReview(ctx);
    case "followup":
      return handleFollowUp(ctx);
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

async function handleReview(ctx: CommandContext) {
  const code = ctx.options.code;
  const commitUrl = ctx.options.commit_url;

  if (!code && !commitUrl) {
    await followUp(
      ctx,
      "Please provide either `code` or `commit_url`.\n" +
        "Example: `/review code:function add(a,b){return a+b}`\n" +
        "Example: `/review commit_url:https://github.com/owner/repo/commit/abc123`"
    );
    return;
  }

  const t0 = Date.now();
  const elapsed = () => `${Date.now() - t0}ms`;

  try {
    console.log(`[discord] /review START`, {
      hasCode: !!code,
      codeLength: code?.length,
      hasCommitUrl: !!commitUrl,
      user: ctx.user.username,
    });

    let reviewInput: string;
    let title: string;

    if (commitUrl) {
      const parsed = parseCommitInput(commitUrl);
      if (!parsed) {
        await followUp(ctx, "**Invalid commit URL format.** Use a GitHub commit URL like `https://github.com/owner/repo/commit/sha`");
        return;
      }
      console.log(`[discord] /review [${elapsed()}] fetching commit data...`);
      const commitData = await fetchCommitData(parsed.owner, parsed.repo, parsed.sha);
      console.log(`[discord] /review [${elapsed()}] commit fetched, diff length: ${commitData.diff.length}`);
      reviewInput = commitData.diff;
      title = commitData.message.split("\n")[0].slice(0, 80);
    } else {
      reviewInput = code!;
      title = code!.slice(0, 80).replace(/\n/g, " ");
    }

    console.log(`[discord] /review [${elapsed()}] running multi-agent review (input: ${reviewInput.length} chars)...`);
    const results = await withTimeout(
      runMultiAgentReview(reviewInput),
      REVIEW_TIMEOUT_MS,
      "Code review"
    );
    console.log(`[discord] /review [${elapsed()}] review complete — ${results.length} agents returned`);
    const summary = formatDiscordSummary(results);
    console.log(`[discord] /review [${elapsed()}] summary formatted: ${summary.length} chars`);

    // Save to DB if user is linked
    let convIdNote = "";
    const userId = await getUserIdByDiscordId(ctx.user.id);
    if (userId) {
      const convId = crypto.randomUUID();
      console.log(`[discord] /review [${elapsed()}] saving to DB as ${convId}...`);
      await createConversation({ id: convId, title, userId });
      await createMessage({
        id: crypto.randomUUID(),
        conversationId: convId,
        role: "user",
        content: reviewInput,
      });
      await createMessage({
        id: crypto.randomUUID(),
        conversationId: convId,
        role: "assistant",
        content: "Multi-agent review complete",
        metadata: JSON.stringify(results),
      });
      console.log(`[discord] /review [${elapsed()}] DB saved`);
      convIdNote = `\n\n_Use \`/followup message:your question\` to ask about this review._`;
    }

    const finalMessage = summary + convIdNote;
    console.log(`[discord] /review [${elapsed()}] sending followUp (${finalMessage.length} chars)...`);
    await followUp(ctx, finalMessage);
    console.log(`[discord] /review [${elapsed()}] DONE`);
  } catch (err) {
    console.error(`[discord] /review [${elapsed()}] ERROR:`, err);
    const msg = err instanceof Error ? err.message : String(err);
    await followUp(ctx, `**Review failed:** ${msg}`);
  }
}

async function handleFollowUp(ctx: CommandContext) {
  const userMessage = ctx.options.message;
  const convId = ctx.options.id;

  if (!userMessage) {
    await followUp(ctx, "Please provide a message: `/followup message:your question`");
    return;
  }

  try {
    const userId = await getUserIdByDiscordId(ctx.user.id);
    if (!userId) {
      await followUp(
        ctx,
        "**Account not linked.** `/followup` needs access to your reviews.\n" +
          "Link your account: go to **Settings** in the web app, generate a code, then use `/connect CODE` here."
      );
      return;
    }

    // Load conversation
    let conversation;
    if (convId) {
      conversation = await getConversationById(convId);
      if (!conversation || conversation.userId !== userId) {
        await followUp(ctx, `**Not found** — no review with ID \`${convId}\` in your account.`);
        return;
      }
    } else {
      const latest = await getLatestReviewByUser(userId);
      if (!latest) {
        await followUp(ctx, "No reviews found. Run `/review` first!");
        return;
      }
      conversation = latest.conversation;
    }

    // Load messages to build context
    const dbMessages = await getMessagesByConversation(conversation.id);
    const userMsg = dbMessages.find((m) => m.role === "user");
    const assistantMsg = dbMessages.find(
      (m) => m.role === "assistant" && m.metadata
    );

    const codeContent = userMsg?.content ?? "";
    let reviewResults: AgentReviewResult[] = [];
    if (assistantMsg?.metadata) {
      try {
        reviewResults = JSON.parse(assistantMsg.metadata);
      } catch {
        // Invalid JSON, proceed with empty results
      }
    }

    const systemPrompt = `You are a helpful code review assistant. You have full context of a multi-agent code review. Answer follow-up questions about the findings, explain issues, suggest fixes, or discuss the code.

${formatReviewContext(codeContent, reviewResults)}

Be concise but thorough. Use markdown formatting. When referencing findings, quote them precisely. When suggesting code fixes, use fenced code blocks.`;

    // Build conversation history for context
    const chatMessages = dbMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => !m.metadata || m.role === "user")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Add the new user message
    chatMessages.push({ role: "user", content: userMessage });

    const { text } = await withTimeout(
      generateText({
        model: gateway("openai/gpt-5-nano"),
        system: systemPrompt,
        messages: chatMessages,
      }),
      REVIEW_TIMEOUT_MS,
      "Follow-up generation"
    );

    // Save messages to DB
    await createMessage({
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: "user",
      content: userMessage,
    });
    await createMessage({
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: "assistant",
      content: text,
    });

    // Truncate to Discord's 2000-char limit
    const response = text.length > 1950
      ? text.slice(0, 1950) + "\n\n... (truncated)"
      : text;

    await followUp(ctx, response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await followUp(ctx, `**Follow-up failed:** ${msg}`);
  }
}
