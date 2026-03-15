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
Your sole responsibility is to analyze the conversation history and the user's latest request, then route the task to the appropriate specialized agent.

Available Routing Options:
- "rag": Choose this if the user is asking a question about the existing codebase, architecture, or needs to search for context.
- "react": Choose this if the user wants to write new code, modify files, run tests, or execute Git commands.
- "human": Choose this ONLY if the system is waiting for explicit user approval for a sensitive DevOps action (like merging a PR or pushing to main).
- "end": Choose this if the user's request has been fully resolved or if it's just casual conversation not requiring tools.

Current DevOps Context:
- Active Branch: ${state.devopsContext.activeBranch}
- Uncommitted Changes: ${state.devopsContext.hasUncommittedChanges}

Analyze the request, extract the core technical task, and make your routing decision.`;
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
      name: this.name,
    });

    // 5. Return the state updates
    return {
      next: decision.nextAgent,
      currentTask: decision.extractedTask,
      messages: [observationMessage],
    };
  }
}