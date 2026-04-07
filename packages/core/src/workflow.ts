import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DevAIState, DevAIStateType } from "./state.js";
import { ManagerAgent, FileExplorerAgent, ReActAgent } from "./agents/index.js";
import { allTools } from "@devai/tools";
import { SemanticRagAgent } from "./agents/semantic-rag.js";

// 1. Define an interface for our flexible model architecture
export interface DevAIModelConfig {
  managerModel: any;
  ragModel: any;
  reactModel: any;
  retriever: any;
}

// 2. Accept the config object
export function createDevAIGraph(config: DevAIModelConfig) {
  // 3. Inject the models dynamically based on user choice
  const manager = new ManagerAgent(config.managerModel);
  const fileExplorer = new FileExplorerAgent(config.ragModel);
  const react = new ReActAgent(config.reactModel);
  const semanticRag = new SemanticRagAgent(config.ragModel,config.retriever)

  const toolNode = new ToolNode(allTools as any[]);

  const workflow = new StateGraph(DevAIState)
    .addNode("manager", async (state) => await manager.execute(state))
    .addNode("file_explorer", async (state) => await fileExplorer.execute(state))
    .addNode("react", async (state) => await react.execute(state))
    .addNode("semantic_rag", async (state) => await semanticRag.execute(state))
    .addNode("tools", toolNode)
    .addEdge(START, "manager")
    .addConditionalEdges("manager", (state: DevAIStateType) => state.next, {
      file_explorer: "file_explorer",
      react: "react",
      semantic_rag: "semantic_rag",
      human: END,
      end: END,
    })
    // (Keep your existing END shortcuts here to prevent local loops!)
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

    .addEdge("tools", "manager");

  return workflow.compile();
}