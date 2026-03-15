import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DevAIState, DevAIStateType } from "./state.js";
import { ManagerAgent, RAGAgent, ReActAgent } from "./agents/index.js";
import { allTools } from "@devai/tools";

export function createDevAIGraph(model: any) {
  // 1. Initialize our agents with the injected LLM
  const manager = new ManagerAgent(model);
  const rag = new RAGAgent(model);
  const react = new ReActAgent(model);

  // 2. Initialize the ToolNode (LangGraph's built-in executor for bound tools)
  const toolNode = new ToolNode(allTools);

  // 3. Build the State Machine
  const workflow = new StateGraph(DevAIState)
    // Add the execution nodes
    .addNode("manager", async (state) => await manager.execute(state))
    .addNode("rag", async (state) => await rag.execute(state))
    .addNode("react", async (state) => await react.execute(state))
    .addNode("tools", toolNode)

    // The graph ALWAYS starts by asking the Manager to evaluate the request
    .addEdge(START, "manager")

    // 4. The Switchboard: Route based on the Manager's strict JSON output
    .addConditionalEdges("manager", (state: DevAIStateType) => state.next, {
      rag: "rag",
      react: "react",
      human: END, // We pause the graph here if human approval is needed
      end: END,   // Task complete
    })

    // 5. Tool Routing Logic for the Worker Agents
    // If the RAG agent decides to use a tool, route to 'tools', otherwise it's done.
    .addConditionalEdges("rag", (state: DevAIStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      return (lastMessage as any)?.tool_calls?.length ? "tools" : "manager";
    })
    
    // If the ReAct agent decides to use a tool, route to 'tools', otherwise back to manager.
    .addConditionalEdges("react", (state: DevAIStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      return (lastMessage as any)?.tool_calls?.length ? "tools" : "manager";
    })

    // 6. After a tool executes, send the results back to the Manager to re-evaluate
    .addEdge("tools", "manager");

  // Compile and return the executable graph
  return workflow.compile();
}