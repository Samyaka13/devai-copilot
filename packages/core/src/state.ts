import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { DevOpsContext } from "./schema.js";

export const DevAIState = Annotation.Root({
  // Append-only message history
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // The high-level objective requested by the user
  objective: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  // The current sub-task broken down by the Manager
  currentTask: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  // Routing flag for LangGraph conditional edges
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "manager",
  }),

  // Critical for the human-in-the-loop checkpointing
  approvalState: Annotation<"pending" | "approved" | "rejected" | "none">({
    reducer: (x, y) => y ?? x,
    default: () => "none",
  }),

  // Deep merge for complex nested DevOps context
  devopsContext: Annotation<DevOpsContext>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({
      activeBranch: "main",
      modifiedFiles: [],
      hasUncommittedChanges: false,
      lastCiRunStatus: "none",
    }),
  }),
});

export type DevAIStateType = typeof DevAIState.State;