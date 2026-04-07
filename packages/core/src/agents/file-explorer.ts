import { BaseAgent } from "./base.js";
import { DevAIStateType } from "../state.js";
import { readOnlyTools } from "@devai/tools";

export class FileExplorerAgent extends BaseAgent {
  constructor(model: any) {
    super(model, "file_explorer");
  }

  protected getSystemPrompt(state: DevAIStateType): string {
    return `You are the File Explorer Agent for DevAI Copilot. 
Your sole responsibility is to explore the codebase, read files, and answer the user's questions about architecture, implementation, and existing code.

Instructions:
1. You have access to tools that can list directories and read file contents.
2. If the user asks about a specific file, use the "read_file" tool to examine it before answering.
3. If you do not know the exact path, use the "list_directory" tool to find it.
4. DO NOT write code, modify files, or run Git commands. Your job is strictly read-only analysis.
5. Provide clear, structured explanations of the code you retrieve.

Current Task from Manager: ${state.currentTask}
`;
  }

  public async execute(state: DevAIStateType): Promise<Partial<DevAIStateType>> {
    // 1. Give the LLM access strictly to the read-only file system tools
    if (!this.model.bindTools) {
      throw new Error("The provided model does not support tool binding.");
    }
    const modelWithTools = this.model.bindTools(readOnlyTools);

    // 2. Build the prompt using the conversation history
    const messages = this.buildPrompt(state);

    // 3. Invoke the model
    // If it needs to read a file, the response will contain a 'tool_calls' array.
    // If it already read the file on a previous loop, it will return the final text answer.
    const response = await modelWithTools.invoke(messages);

    // 4. Return the new message to append to the state
    return {
      messages: [response],
    };
  }
}