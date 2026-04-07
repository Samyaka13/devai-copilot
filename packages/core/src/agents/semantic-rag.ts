import { DevAIStateType } from "../state.js";
import { BaseAgent } from "./base.js";
import { HumanMessage } from "@langchain/core/messages";

export class SemanticRagAgent extends BaseAgent {
    constructor(model: any, private retriever: any) {
        super(model, "semantic_rag");
    }

    protected getSystemPrompt(state: DevAIStateType): string {
        return `You are the Semantic Retrieval Agent for DevAI Copilot.
Your job is to answer the user's questions based ONLY on the provided codebase context.

CRITICAL RULES:
1. If the answer is not in the provided context, say "I cannot find the answer in the current codebase."
2. Do NOT hallucinate or guess.
3. Explain the retrieved code clearly and concisely, mentioning the file names.

Task: ${state.currentTask}`;
    }

    public async execute(state: DevAIStateType): Promise<Partial<DevAIStateType>> {
        const query = state.currentTask;

        // 1. Fetch relevant code snippets from the vector store
        const docs = await this.retriever.invoke(query);

        // 2. Format the retrieved documents into a readable string with source metadata
        const context = docs.map((d: any, i: number) => `--- Snippet ${i + 1} (Source: ${d.metadata?.source || 'Unknown'}) ---\n${d.pageContent}`).join("\n\n");

        // 3. Get the base conversation history from the parent class
        const baseMessages = this.buildPrompt(state);

        // 4. Inject the retrieved context safely into the final execution
        const finalMessages = [
            ...baseMessages,
            new HumanMessage(`Here is the retrieved context from the codebase to help you answer the user's request:\n\n${context}`)
        ];

        // 5. Generate the response
        const response = await this.model.invoke(finalMessages);

        // 6. Return the AI's response to update the graph state
        return {
            messages: [response],
        };
    }
}