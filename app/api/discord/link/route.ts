import { auth } from "@/lib/auth";
import {
  getDiscordLinkByUser,
  createDiscordLink,
  deleteDiscordLink,
} from "@/lib/db/queries";
import { headers } from "next/headers";
import { randomBytes } from "crypto";

function generateCode(): string {
  return randomBytes(3).toString("hex").toUpperCase(); // 6-char hex
}

/** GET — check link status */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const link = await getDiscordLinkByUser(session.user.id);

  if (!link) {
    return Response.json({ status: "none" });
  }

  if (link.discordUserId && link.linkedAt) {
    return Response.json({
      status: "linked",
      discordUsername: link.discordUsername,
      linkedAt: link.linkedAt,
    });
  }

  if (link.code && link.codeExpiresAt) {
    const expired = new Date() > link.codeExpiresAt;
    if (expired) {
      await deleteDiscordLink(session.user.id);
      return Response.json({ status: "none" });
    }
    return Response.json({
      status: "pending",
      code: link.code,
      expiresAt: link.codeExpiresAt,
    });
  }

  return Response.json({ status: "none" });
}

/** POST — generate a new 6-char link code */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getDiscordLinkByUser(session.user.id);

  // Already linked — must unlink first
  if (existing?.discordUserId) {
    return Response.json(
      { error: "Already linked. Unlink first." },
      { status: 409 }
    );
  }

  // Delete any existing pending link
  if (existing) {
    await deleteDiscordLink(session.user.id);
  }

  const code = generateCode();
  const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  const id = crypto.randomUUID();

  const link = await createDiscordLink({
    id,
    userId: session.user.id,
    code,
    codeExpiresAt,
  });

  return Response.json({
    status: "pending",
    code: link!.code,
    expiresAt: link!.codeExpiresAt,
  });
}

/** DELETE — unlink Discord account */
export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteDiscordLink(session.user.id);
  return Response.json({ status: "none" });
}
