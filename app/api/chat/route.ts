import { streamText, UIMessage, convertToModelMessages, gateway } from "ai";
import { codeReviewerSystemPrompt } from "@/agents/code-reviewer";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gateway("anthropic/claude-sonnet-4-5"),
    system: `${codeReviewerSystemPrompt}

Format your review as markdown with:
- A score out of 10
- A brief summary
- Findings grouped by severity (Critical, High, Medium, Low, Info)
- Each finding with: title, description, and suggested fix`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
