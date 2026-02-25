import type { AgentName } from "./schemas";

export const agentLabels: Record<AgentName, { label: string; icon: string }> = {
  "code-reviewer": { label: "Code Reviewer", icon: "CR" },
  security: { label: "Security", icon: "SC" },
  performance: { label: "Performance", icon: "PF" },
  testing: { label: "Testing", icon: "TS" },
};
