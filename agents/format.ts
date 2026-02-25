import type { AgentReviewResult } from "./schemas";

export function formatReviewContext(
  code: string,
  results: AgentReviewResult[]
): string {
  let context = `## Original Code Under Review\n\`\`\`\n${code}\n\`\`\`\n\n`;
  context += `## Review Results\n\n`;
  for (const r of results) {
    context += `### ${r.agent} (Score: ${r.result?.score ?? "N/A"}/10)\n`;
    context += `${r.result?.summary ?? "No summary"}\n\n`;
    for (const f of r.result?.findings ?? []) {
      context += `- **[${f.severity.toUpperCase()}] ${f.title}**${f.lineReference ? ` (${f.lineReference})` : ""}: ${f.description}\n  Suggestion: ${f.suggestion}\n`;
    }
    context += "\n";
  }
  return context;
}
