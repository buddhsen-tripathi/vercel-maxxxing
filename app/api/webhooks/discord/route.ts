import { getBot } from "@/lib/bot";
import { after } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const bot = getBot();
  if (!bot) {
    return Response.json(
      { error: "Discord bot not configured" },
      { status: 503 }
    );
  }

  return bot.webhooks.discord(request, {
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
