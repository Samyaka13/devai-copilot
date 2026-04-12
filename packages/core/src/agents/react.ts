import { BaseAgent } from "./base.js";
import { DevAIStateType } from "../state.js";
import { allTools } from "@devai/tools";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export class ReActAgent extends BaseAgent {
  constructor(model: BaseChatModel) {
    super(model, "react");
  }

  protected getSystemPrompt(state: DevAIStateType): string {
    return `You are the ReAct (Reason + Act) Execution Agent for DevAI Copilot.
Your job is to autonomously execute the development or DevOps task assigned by the Manager.

Instructions:
1. You have access to tools for reading/writing files and executing Git commands.
2. Think step-by-step. If you need to modify a file, read it first to understand its current state.
3. If you write code, ensure it is complete and correct.
4. If the task involves version control, use the git tools to check status or diffs.
5. Do NOT ask the user for permission to use tools; just use them. (Human approval is handled at a higher system level).
6. Once you have fully completed the task, explicitly state that you are finished.

Current Task from Manager: ${state.currentTask}
Active Branch: ${state.devopsContext.activeBranch}
`;
  }

  public async execute(state: DevAIStateType): Promise<Partial<DevAIStateType>> {
    // 1. Safety check
    if (!this.model.bindTools) {
      throw new Error("The provided model does not support tool binding. A tool-calling LLM is required for the ReAct Agent.");
    }

    // 2. Bind ALL tools (fs + git) so the agent can actually act
    const modelWithTools = this.model.bindTools(allTools);

    // 3. Build the prompt using the conversation history
    const messages = this.buildPrompt(state);

    // 4. Invoke the model safely
    const response = await this.safeInvoke(messages, modelWithTools);

    // 5. Return the new message to append to the state
    return {
      messages: [response],
    };
  }
}