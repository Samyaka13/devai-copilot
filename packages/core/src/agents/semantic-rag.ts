import { DevAIStateType } from "../state.js";
import { BaseAgent } from "./base.js";
import { HumanMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { VectorStoreRetriever } from "@langchain/core/vectorstores";

export class SemanticRagAgent extends BaseAgent {
    constructor(model: BaseChatModel, private retriever: VectorStoreRetriever | null) {
        super(model, "semantic_rag");
    }

    protected getSystemPrompt(state: DevAIStateType): string {
        return `You are the Semantic Retrieval Agent for DevAI Copilot.
Your job is to answer the user's questions based ONLY on the provided codebase context.

CRITICAL RULES:
1. If the answer is not in the provided context, say "I cannot find the answer in the current codebase."
2. Do NOT hallucinate or guess.
3. Explain the retrieved code clearly and concisely, mentioning file names from the context.
4. NEVER fabricate tool calls, directory listings, or file contents. You do NOT have access to tools.
5. Only reference files and code that appear in the provided context snippets below.
6. Do NOT invent filenames or paths that are not in the context.

Task: ${state.currentTask}`;
    }

    public async execute(state: DevAIStateType): Promise<Partial<DevAIStateType>> {
        const query = state.currentTask;

        // Guard: If no retriever was initialized (e.g. no codebase path), return a helpful message
        if (!this.retriever) {
            const { AIMessage } = await import("@langchain/core/messages");
            return {
                messages: [new AIMessage({
                    content: "No codebase has been indexed yet. Please set the DEVAI_CONTEXT_PATH environment variable or ensure a valid source directory exists.",
                    name: "semantic_rag",
                })],
            };
        }

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

        // 5. Generate the response safely
        const response = await this.safeInvoke(finalMessages);

        // 6. Return the AI's response to update the graph state
        return {
            messages: [response],
        };
    }
}