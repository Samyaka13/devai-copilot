import { BaseAgent } from "./base.js";
import { DevAIStateType } from "../state.js";

export class ChatAgent extends BaseAgent {
  constructor(model: any) {
    super(model, "chat");
  }

  protected getSystemPrompt(_state: DevAIStateType): string {
    return `You are DevAI Copilot, a helpful developer assistant. You are currently handling a generic conversational request. Respond naturally to the user. Do not output any JSON or tool requests. Keep it brief and friendly.`;
  }

  public async execute(state: DevAIStateType): Promise<Partial<DevAIStateType>> {
    const messages = this.buildPrompt(state);
    const response = await this.model.invoke(messages);
    return {
      messages: [response],
    };
  }
}
