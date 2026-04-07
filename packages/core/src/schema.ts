import { z } from "zod";

// Validates the Manager Agent's routing decision
export const ManagerDecisionSchema = z.object({
  nextAgent: z.enum(["semantic_rag", "file_explorer", "react", "human", "end"]),
  reasoning: z.string().describe("Explanation for why this agent was chosen"),
  extractedTask: z.string().describe("The specific sub-task for the next agent"),
});

// Validates DevOps specific context
export const DevOpsContextSchema = z.object({
  activeBranch: z.string().default("main"),
  modifiedFiles: z.array(z.string()).default([]),
  hasUncommittedChanges: z.boolean().default(false),
  lastCiRunStatus: z.enum(["success", "failed", "pending", "none"]).default("none"),
});

export type ManagerDecision = z.infer<typeof ManagerDecisionSchema>;
export type DevOpsContext = z.infer<typeof DevOpsContextSchema>;