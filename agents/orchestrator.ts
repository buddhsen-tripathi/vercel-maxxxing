import { generateText, Output, gateway } from "ai";
import {
  agentResultSchema,
  type AgentName,
  type AgentReviewResult,
} from "./schemas";
import { agentLabels } from "./constants";
import { codeReviewerSystemPrompt } from "./code-reviewer";
import { securityAgentSystemPrompt } from "./security-agent";
import { performanceAgentSystemPrompt } from "./performance-agent";
import { testingAgentSystemPrompt } from "./testing-agent";

const agentConfigs: Record<AgentName, string> = {
  "code-reviewer": codeReviewerSystemPrompt,
  security: securityAgentSystemPrompt,
  performance: performanceAgentSystemPrompt,
  testing: testingAgentSystemPrompt,
};

async function runSingleAgent(
  agent: AgentName,
  codeInput: string
): Promise<AgentReviewResult> {
  try {
    const { output } = await generateText({
      model: gateway("openai/gpt-5-nano"),
      system: agentConfigs[agent],
      prompt: `Review the following code:\n\n${codeInput}`,
      output: Output.object({ schema: agentResultSchema }),
    });

    return { agent, result: output };
  } catch (err) {
    return {
      agent,
      result: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Runs all 4 agents in parallel via Promise.allSettled.
 * Used by both the web API route and the Discord bot.
 */
export async function runMultiAgentReview(
  codeInput: string
): Promise<AgentReviewResult[]> {
  const agents: AgentName[] = [
    "code-reviewer",
    "security",
    "performance",
    "testing",
  ];

  const results = await Promise.allSettled(
    agents.map((agent) => runSingleAgent(agent, codeInput))
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      agent: agents[i],
      result: null,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Agent failed unexpectedly",
    };
  });
}

/**
 * Runs agents in parallel, calling onResult as each completes.
 * Used by the streaming API route for real-time UI updates.
 */
export async function runMultiAgentReviewStreaming(
  codeInput: string,
  onResult: (result: AgentReviewResult) => void
): Promise<AgentReviewResult[]> {
  const agents: AgentName[] = [
    "code-reviewer",
    "security",
    "performance",
    "testing",
  ];

  const allResults: AgentReviewResult[] = [];

  const promises = agents.map(async (agent) => {
    const result = await runSingleAgent(agent, codeInput);
    onResult(result);
    allResults.push(result);
    return result;
  });

  await Promise.allSettled(promises);
  return allResults;
}

/**
 * Format agent results as a Discord/text summary.
 */
export function formatDiscordSummary(
  results: AgentReviewResult[]
): string {
  const lines: string[] = ["**Code Review Summary**\n"];

  let totalFindings = 0;
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const { agent, result, error } of results) {
    const label = agentLabels[agent].label;
    if (error || !result) {
      lines.push(`**${label}** — Error: ${error ?? "No result"}`);
      continue;
    }

    lines.push(`**${label}** — ${result.score}/10`);

    for (const f of result.findings) {
      totalFindings++;
      severityCounts[f.severity]++;
      const sev = f.severity.toUpperCase();
      const ref = f.lineReference ? ` \`${f.lineReference}\`` : "";
      lines.push(`- ${sev}: ${f.title}${ref}`);
    }
    lines.push("");
  }

  const counts = Object.entries(severityCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");

  lines.push(`${totalFindings} findings (${counts})`);

  return lines.join("\n");
}

