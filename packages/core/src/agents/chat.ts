import { BaseAgent } from "./base.js";
import { DevAIStateType } from "../state.js";

export class ChatAgent extends BaseAgent {
  constructor(model: any) {
    super(model, "chat");
  }

  protected getSystemPrompt(_state: DevAIStateType): string {
    return `You are DevAI Copilot, an autonomous AI-powered DevOps engineer and developer assistant.
You are currently in conversational mode, handling a generic request that doesn't require code analysis or tool execution.

Your capabilities (which are handled by other specialized agents) include:
- Searching and understanding codebases semantically
- Reading and writing files
- Running Git commands (status, diff, commit)
- Executing multi-step development workflows

Respond naturally, warmly, and concisely. Do not output any JSON, tool calls, or structured data.
If the user asks about your capabilities, briefly describe them.
Keep responses short (2-4 sentences) unless the user asks for more detail.`;
  }

  public async execute(state: DevAIStateType): Promise<Partial<DevAIStateType>> {
    const messages = this.buildPrompt(state);
    const response = await this.model.invoke(messages);
    return {
      messages: [response],
    };
  }
}
