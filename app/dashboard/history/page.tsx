import { auth } from "@/lib/auth";
import { getConversationsByUser } from "@/lib/db/queries";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HistoryList } from "@/components/review/history-list";
import { History } from "lucide-react";

export default async function HistoryPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  let conversations: Awaited<ReturnType<typeof getConversationsByUser>> = [];
  try {
    conversations = await getConversationsByUser(session.user.id);
  } catch {
    // DB not available
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Review History</h1>
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <History className="h-10 w-10 opacity-40" />
          <p className="text-sm">No reviews yet. Submit some code to get started.</p>
        </div>
      ) : (
        <HistoryList conversations={conversations} />
      )}
    </div>
  );
}
