import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SystemMessage, BaseMessage } from "@langchain/core/messages";
import { DevAIStateType } from "../state.js";

/**
 * Abstract base class that all specialized agents must extend.
 * Enforces a strict architectural contract for the LangGraph nodes.
 */
export abstract class BaseAgent {
  // Dependency Injection: The specific LLM (Ollama, Groq, etc.) is passed in, not hardcoded.
  protected model: BaseChatModel;
  public readonly name: string;

  constructor(model: BaseChatModel, name: string) {
    this.model = model;
    this.name = name;
  }

  /**
   * Every agent must define its own specific instructions and persona,
   * dynamically reacting to the current state of the graph.
   */
  protected abstract getSystemPrompt(state: DevAIStateType): string;

  /**
   * The core execution function called by LangGraph.
   * Must return a Partial<DevAIStateType> to merge updates into the global state.
   */
  public abstract execute(state: DevAIStateType): Promise<Partial<DevAIStateType>>;

  /**
   * Utility method to cleanly bundle the system prompt with the conversation history.
   */
  protected buildPrompt(state: DevAIStateType): BaseMessage[] {
    return [
      new SystemMessage(this.getSystemPrompt(state)),
      ...state.messages,
    ];
  }
}