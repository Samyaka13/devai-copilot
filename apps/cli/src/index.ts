import { HumanMessage } from "@langchain/core/messages";
import { createDevAIGraph } from "@devai/core";
import * as readline from "node:readline";
import { ChatOllama } from "@langchain/ollama";

// 1. Initialize the local Ollama model
// Make sure you have pulled a capable model locally, e.g., `ollama run llama3.1` or `qwen2.5-coder`
const model = new ChatOllama({
  baseUrl: "http://localhost:11434", // Default Ollama port
  model: "llama3.1", // Change this to whatever model you have pulled
  temperature: 0, // 0 is best for strict coding and routing tasks
  });

// 2. Compile our LangGraph multi-agent workflow
const graph = createDevAIGraph(model);

// 3. Set up the terminal input interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🚀 DevAI Copilot CLI Initialized.");
console.log("Type 'exit' to quit.\n");

const askQuestion = () => {
  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    try {
      // 4. Run the user's input through the LangGraph state machine
      console.log("\n[DevAI is thinking...]");
      
      const initialState = {
        messages: [new HumanMessage(input)],
      };

      // Stream the events as the agents talk to each other
      const stream = await graph.stream(initialState, { streamMode: "values" });

      for await (const event of stream) {
        const lastMessage = event.messages[event.messages.length - 1];
        
        // Print the agent's response or tool execution status
        if (lastMessage.name) {
            console.log(`\n🤖 [${lastMessage.name}]: ${lastMessage.content}`);
        } else if (lastMessage._getType() === "ai") {
            console.log(`\n🤖: ${lastMessage.content}`);
        }
      }
      
    } catch (error) {
      console.error("\n❌ Error executing graph:", error);
    }

    console.log("\n-----------------------------------");
    askQuestion();
  });
};

// Start the chat loop
askQuestion();