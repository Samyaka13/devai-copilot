import { AIMessage } from "@langchain/core/messages";
import { BaseAgent } from "./base.js";
import { DevAIStateType } from "../state.js";
import { ManagerDecisionSchema } from "../schema.js";

export class ManagerAgent extends BaseAgent {
  constructor(model: any) {
    // We pass the model up to the BaseAgent constructor
    super(model, "manager");
  }

  protected getSystemPrompt(state: DevAIStateType): string {
    return `You are the Manager Agent for DevAI Copilot, an autonomous AI DevOps engineer and developer assistant.
Your sole responsibility is to analyze the conversation history and route the task to the appropriate specialized agent.

Available Routing Options:
- "semantic_rag": Choose this when the user asks conceptual questions about the codebase ("How does X work?", "Find where Y is implemented") and you DO NOT know the exact file path yet.
- "file_explorer": Choose this to read exact file contents (e.g. "Read src/index.ts") or list exact directories when you ALREADY know the specific absolute or relative path.
- "chat": Choose this for generic conversational requests (greetings, simple questions) that don't require checking files, running code, or specific DevAI operations.
- "react": Choose this to write code, modify files, run tests, or execute Git commands.
- "human": Choose this ONLY if waiting for explicit user approval for a sensitive action.
- "end": Choose this if the user's overarching request has been completely fulfilled.

CRITICAL RULES TO PREVENT INFINITE LOOPS:
1. Analyze the chat history carefully. If the RAG or ReAct agent just provided a final answer that satisfies the user's request, you MUST choose "end". Do not repeat the task.
2. For multi-step tasks (e.g., "Read X, then write Y"): If semantic_rag or file_explorer just finished reading X, you MUST now route to "react" to write Y. 
3. Never route to the same agent twice in a row unless the user provided new instructions.

Current DevOps Context:
- Active Branch: ${state.devopsContext.activeBranch}
- Uncommitted Changes: ${state.devopsContext.hasUncommittedChanges}

Analyze the history, extract the next logical sub-task, and make your routing decision.`;
  }

  public async execute(state: DevAIStateType): Promise<Partial<DevAIStateType>> {
    // 1. Bind the Zod schema to the model to force strict JSON output
    const structuredModel = this.model.withStructuredOutput(ManagerDecisionSchema, {
      name: "manager_decision",
    });

    // 2. Build the prompt using the BaseAgent utility
    const messages = this.buildPrompt(state);

    // 3. Invoke the model. Because of withStructuredOutput, 'decision' is strictly typed!
    const decision = await structuredModel.invoke(messages);

    // 4. Create an AI message for observability (so users can see the routing process)
    const observationMessage = new AIMessage({
      content: `[Manager Decision] Routing to: ${decision.nextAgent}. Reasoning: ${decision.reasoning}`,
      name: "manager",
    });

    // 5. Return the state updates
    return {
      next: decision.nextAgent,
      currentTask: decision.extractedTask,
      messages: [observationMessage],
    };
  }
}