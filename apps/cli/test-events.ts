import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createDevAIGraph } from "../../packages/core/src/workflow.js";
import { ChatOllama } from "@langchain/ollama";

async function run() {
  const ollama = new ChatOllama({ model: "llama3.1" });
  const graph = createDevAIGraph({
    managerModel: ollama, ragModel: ollama, reactModel: ollama, retriever: null
  });

  const stream = await graph.streamEvents({ messages: [new HumanMessage("Hello")] }, { version: "v2" });
  for await (const event of stream) {
    if (event.event === "on_chain_end") {
      console.log(`Node: ${event.metadata?.langgraph_node}, Name: ${event.name}`);
    }
  }
}
run().catch(console.error);
