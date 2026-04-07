import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph"; // <-- Added MemorySaver
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DevAIState, DevAIStateType } from "./state.js";
import { ManagerAgent, FileExplorerAgent, ReActAgent, ChatAgent } from "./agents/index.js";
import { allTools } from "@devai/tools";
import { SemanticRagAgent } from "./agents/semantic-rag.js";

export interface DevAIModelConfig {
  managerModel: any;
  ragModel: any;
  reactModel: any;
  retriever: any;
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
    .addNode("tools", toolNode)
    
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
      return (lastMessage as any)?.tool_calls?.length ? "tools" : END;
    })
    .addConditionalEdges("react", (state: DevAIStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      return (lastMessage as any)?.tool_calls?.length ? "tools" : END;
    })
    .addConditionalEdges("semantic_rag", (state: DevAIStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      return (lastMessage as any)?.tool_calls?.length ? "tools" : END;
    })
    .addEdge("chat", END)
    
    .addEdge("tools", "manager");

  // Initialize the in-memory database
  const checkpointer = new MemorySaver();

  // Compile the graph with the checkpointer attached
  return workflow.compile({ checkpointer });
}