import { getBot } from "@/lib/bot";
import { handleSlashCommand } from "@/lib/discord-commands";
import { verifyKey } from "discord-interactions";
import { after } from "next/server";

export const maxDuration = 60;

const INTERACTION_TYPE_PING = 1;
const INTERACTION_TYPE_APPLICATION_COMMAND = 2;

const RESPONSE_PONG = 1;
const RESPONSE_DEFERRED = 5; // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE

export async function POST(request: Request) {
  const bot = getBot();
  if (!bot) {
    return Response.json(
      { error: "Discord bot not configured" },
      { status: 503 }
    );
  }

  // Clone the request so we can read the body for slash command detection
  // while still passing the original to the Chat SDK
  const bodyBytes = await request.arrayBuffer();
  const bodyText = new TextDecoder().decode(bodyBytes);

  // Verify signature
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "";

  if (!signature || !timestamp) {
    return new Response("Missing signature", { status: 401 });
  }

  const isValid = await verifyKey(
    new Uint8Array(bodyBytes),
    signature,
    timestamp,
    publicKey
  );
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  let interaction: Record<string, unknown>;
  try {
    interaction = JSON.parse(bodyText);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Handle PING
  if (interaction.type === INTERACTION_TYPE_PING) {
    return Response.json({ type: RESPONSE_PONG });
  }

  // Handle slash commands ourselves (the Discord adapter doesn't process these)
  if (interaction.type === INTERACTION_TYPE_APPLICATION_COMMAND) {
    const data = interaction.data as {
      name: string;
      options?: { name: string; value: string }[];
    };
    const user = (
      (interaction.member as { user?: Record<string, string> })?.user ??
      (interaction as { user?: Record<string, string> }).user
    ) as { id: string; username: string };

    const options: Record<string, string> = {};
    for (const opt of data.options ?? []) {
      options[opt.name] = opt.value;
    }

    const applicationId = process.env.DISCORD_APPLICATION_ID ?? "";

    // Defer first, then process in background
    after(async () => {
      await handleSlashCommand({
        commandName: data.name,
        options,
        user,
        token: interaction.token as string,
        applicationId,
      });
    });

    return Response.json({ type: RESPONSE_DEFERRED });
  }

  // For everything else (mentions, components, etc.), reconstruct the request
  // and pass to the Chat SDK
  const reconstructed = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bodyBytes,
  });

  return bot.webhooks.discord(reconstructed, {
    waitUntil: (task) => after(() => task),
  });
}

export async function GET() {
  const bot = getBot();
  return new Response(
    bot ? "Discord webhook active" : "Discord bot not configured",
    { status: bot ? 200 : 503 }
  );
}
