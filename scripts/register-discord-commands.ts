/**
 * One-time script to register Discord slash commands.
 *
 * Usage:
 *   npx tsx scripts/register-discord-commands.ts
 *
 * Requires DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID in .env.local
 */

import "dotenv/config";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID;

if (!TOKEN || !APP_ID) {
  console.error(
    "Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in environment"
  );
  process.exit(1);
}

const commands = [
  {
    name: "summary",
    description: "Post the latest code review summary to this channel",
    options: [
      {
        name: "id",
        description: "Optional conversation ID for a specific review",
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: "connect",
    description: "Link your Discord account to the CodeReview web app",
    options: [
      {
        name: "code",
        description: "6-character link code from the web app Settings page",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "disconnect",
    description: "Unlink your Discord account from the CodeReview web app",
  },
];

async function register() {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Failed to register commands: ${res.status}\n${body}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`Registered ${data.length} command(s):`);
  for (const cmd of data) {
    console.log(`  /${cmd.name} — ${cmd.description}`);
  }
}

register();
