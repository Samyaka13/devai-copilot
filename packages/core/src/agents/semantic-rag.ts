import { DevAIStateType } from "../state.js";
import { BaseAgent } from "./base.js";

export class SemanticRagAgent extends BaseAgent {
    constructor(model: any, private retriever: any) {
        super(model, "semantic_rag");
    }
    protected getSystemPrompt(state: DevAIStateType): string {
        return `You are a semantic retrieval agent.
Retrieve the most relevant code snippets and explain them.

Task: ${state.currentTask}`;
    }
    public async execute(state: DevAIStateType): Promise<Partial<DevAIStateType>> {
        const query = state.currentTask;
        const docs = await this.retriever.getRelevantDocuments(query);
        const context = docs.map((d: any) => d.pageContent).join("\n\n");
        const messages = [
            ...this.buildPrompt(state),
            {
                role: "system",
                content: `Context:\n${context}`,
            },
        ]
        const response = await this.model.invoke(messages);

        return {
            messages: [response],
        };
    }
}
