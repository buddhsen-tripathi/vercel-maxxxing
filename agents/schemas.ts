import { z } from "zod";

export const severityEnum = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);
export type Severity = z.infer<typeof severityEnum>;

export const findingSchema = z.object({
  severity: severityEnum,
  category: z.string().describe("Category of the finding, e.g. 'SQL Injection', 'Memory Leak', 'Missing Test'"),
  title: z.string().describe("Short title summarizing the finding"),
  description: z.string().describe("Detailed explanation of the issue"),
  suggestion: z.string().describe("Actionable fix or improvement recommendation"),
  lineReference: z.string().optional().describe("Relevant line number or range, e.g. 'line 15' or 'lines 20-25'"),
});
export type Finding = z.infer<typeof findingSchema>;

export const agentResultSchema = z.object({
  summary: z.string().describe("Brief overall assessment of the code"),
  findings: z.array(findingSchema).describe("List of specific findings"),
  score: z.number().min(0).max(10).describe("Overall score from 0 (worst) to 10 (best)"),
});
export type AgentResult = z.infer<typeof agentResultSchema>;

export const agentNames = [
  "code-reviewer",
  "security",
  "performance",
  "testing",
] as const;
export type AgentName = (typeof agentNames)[number];

export interface AgentReviewResult {
  agent: AgentName;
  result: AgentResult | null;
  error?: string;
}
