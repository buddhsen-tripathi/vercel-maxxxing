import { handleSlashCommand } from "@/lib/discord-commands";

export const maxDuration = 300;

/**
 * Internal endpoint that runs slow Discord commands (/review, /followup)
 * in their own serverless function, bypassing after()'s execution limits.
 *
 * Called by the Discord webhook route via fire-and-forget fetch.
 */
export async function POST(req: Request) {
  // Verify internal secret to prevent external abuse
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.BETTER_AUTH_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await req.json();

  console.log(`[discord/process] received /${ctx.commandName}`, {
    user: ctx.user?.username,
    options: ctx.options,
  });

  try {
    await handleSlashCommand(ctx);
    console.log(`[discord/process] /${ctx.commandName} completed`);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[discord/process] /${ctx.commandName} crashed:`, err);
    // Try last-resort follow-up
    try {
      const msg = err instanceof Error ? err.message : String(err);
      await fetch(
        `https://discord.com/api/v10/webhooks/${ctx.applicationId}/${ctx.token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `**Command failed:** ${msg.slice(0, 1900)}`,
          }),
        }
      );
    } catch {
      // Nothing more we can do
    }
    return Response.json({ error: "Command failed" }, { status: 500 });
  }
}
