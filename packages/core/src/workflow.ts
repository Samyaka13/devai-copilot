import { StateGraph, START, END, MemorySaver, interrupt } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DevAIState, DevAIStateType } from "./state.js";
import { ManagerAgent, FileExplorerAgent, ReActAgent, ChatAgent } from "./agents/index.js";
import { allTools } from "@devai/tools";
import { SemanticRagAgent } from "./agents/semantic-rag.js";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { VectorStoreRetriever } from "@langchain/core/vectorstores";
import { isAIMessage } from "@langchain/core/messages";

export interface DevAIModelConfig {
  managerModel: BaseChatModel;
  ragModel: BaseChatModel;
  reactModel: BaseChatModel;
  retriever: VectorStoreRetriever | null;
}

export function createDevAIGraph(config: DevAIModelConfig) {
  const manager = new ManagerAgent(config.managerModel);
  const fileExplorer = new FileExplorerAgent(config.ragModel);
  const react = new ReActAgent(config.reactModel);
  const semanticRag = new SemanticRagAgent(config.ragModel, config.retriever);
  const chat = new ChatAgent(config.reactModel); // Using reactModel for chat as it's typically the generic instruction model

  const toolNode = new ToolNode(allTools as any[]);

  const workflow = new StateGraph(DevAIState)
    .addNode("manager", async (state) => await manager.execute(state))
    .addNode("file_explorer", async (state) => await fileExplorer.execute(state))
    .addNode("react", async (state) => await react.execute(state))
    .addNode("semantic_rag", async (state) => await semanticRag.execute(state))
    .addNode("chat", async (state) => await chat.execute(state))
    .addNode("human_approval", (state: DevAIStateType) => {
      // Flag sensitive tool calls using LangGraph v2 interrupt API
      const lastMessage = state.messages[state.messages.length - 1];
      const toolCalls = isAIMessage(lastMessage) ? lastMessage.tool_calls : [];
      
      // Always transition to pending first to signal HITL is waiting for this specific set of tools
      if (state.approvalState !== "pending") {
        return { approvalState: "pending" };
      }

      // Trigger the interrupt
      interrupt({
        action: "approve_tools",
        toolCalls: toolCalls
      });
      
      // If we resumed from interrupt, it means it's approved
      return { approvalState: "approved" };
    })
    .addNode("tools", toolNode)
    .addNode("cleanup", () => ({ 
      approvalState: "none",
      // We also reset next to manager to ensure a clean slate for the next iteration
      next: "manager" 
    }))
    
    .addEdge(START, "manager")
    
    .addConditionalEdges("manager", (state: DevAIStateType) => state.next, {
      file_explorer: "file_explorer",
      react: "react",
      semantic_rag: "semantic_rag",
      chat: "chat",
      human: END,
      end: END,
    })
    
    .addConditionalEdges("file_explorer", (state: DevAIStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      return isAIMessage(lastMessage) && lastMessage.tool_calls?.length ? "tools" : "manager";
    })
    .addConditionalEdges("react", (state: DevAIStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (isAIMessage(lastMessage)) {
        const toolCalls = lastMessage.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          // Flag sensitive tool calls
          const sensitiveTools = ["write_file", "git_status", "git_diff", "git_commit"];
          const isSensitive = toolCalls.some((tc) => sensitiveTools.includes(tc.name));
          return isSensitive ? "human_approval" : "tools";
        }
      }
      return "manager";
    })
    .addConditionalEdges("semantic_rag", (state: DevAIStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      return isAIMessage(lastMessage) && lastMessage.tool_calls?.length ? "tools" : "manager";
    })
    .addEdge("chat", END)
    // human_approval needs a conditional edge to loop back when it returns 'pending'
    .addConditionalEdges("human_approval", (state: DevAIStateType) => {
        if (state.approvalState === "pending") return "human_approval";
        return "tools";
    })
    
    .addEdge("tools", "cleanup")
    .addEdge("cleanup", "manager");

  // Initialize the in-memory database
  const checkpointer = new MemorySaver();

  // Compile the graph with the checkpointer attached
  return workflow.compile({ checkpointer });
}