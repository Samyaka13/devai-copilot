import "dotenv/config"; 
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { createDevAIGraph, DevAIModelConfig } from "@devai/core";
import * as readline from "node:readline";
import * as fs from "node:fs";

import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import * as crypto from "node:crypto";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// --- Helper Functions to initialize models ---
function getGeminiModel() {
  if (!process.env.GOOGLE_API_KEY) {
    console.warn("\n⚠️  WARNING: GOOGLE_API_KEY not found in .env file.");
    console.warn("⚠️  Falling back to Local Ollama model.\n");
    return getOllamaModel();
  }
  const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  return new ChatGoogleGenerativeAI({
    model: modelName,
    temperature: 0,
  });
}

function getOllamaModel() {
  const modelName = process.env.OLLAMA_MODEL || "qwen3.5:4b";
  return new ChatOllama({
    baseUrl: "http://localhost:11434",
    model: modelName,
    temperature: 0,
  });
}

// --- The Semantic RAG Retriever ---
async function getRetriever(choice: string) {
  console.log("\n📚 Loading and Indexing Codebase...");

  // 1. Initialize Embeddings (Translates code into searchable math)
  let embeddings;
  if (choice === "2") {
    embeddings = new OllamaEmbeddings({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
    });
  } else {
    // Fall back to Ollama if no Google key exists
    if (!process.env.GOOGLE_API_KEY) {
      embeddings = new OllamaEmbeddings({
        baseUrl: "http://localhost:11434",
        model: "nomic-embed-text",
      });
    } else {
      embeddings = new GoogleGenerativeAIEmbeddings({
        model: "gemini-embedding-001",
      });
    }
  }

  // 2. Load the actual code files dynamically
  const targetPath = process.env.DEVAI_CONTEXT_PATH || process.cwd();

  // Gracefully handle if the target path doesn't exist
  if (!fs.existsSync(targetPath)) {
    console.warn(`\n⚠️  Codebase path ${targetPath} does not exist. Semantic RAG may return no results.`);
  }

  console.log(`📂 Scanning codebase at: ${targetPath}`);

  const loader = new DirectoryLoader(
    targetPath, 
    {
      ".ts": (filePath) => new TextLoader(filePath),
      ".js": (filePath) => new TextLoader(filePath),
      ".json": (filePath) => new TextLoader(filePath),
      ".md": (filePath) => new TextLoader(filePath),
      ".py": (filePath) => new TextLoader(filePath),
      ".yaml": (filePath) => new TextLoader(filePath),
      ".yml": (filePath) => new TextLoader(filePath),
    },
    true // recursive
  );
  
  const rawDocs = await loader.load();

  // Filter out node_modules, dist, .git, and lock files
  const docs = rawDocs.filter(d => {
    const src = d.metadata?.source || "";
    return !src.includes("node_modules") 
      && !src.includes("/dist/") 
      && !src.includes(".git/")
      && !src.includes("package-lock.json");
  });
  console.log(`✅ Loaded ${docs.length} files from the codebase (filtered from ${rawDocs.length} total).`);

  // 3. Split the code into chunks so the AI can digest it
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocs = await splitter.splitDocuments(docs);
  console.log(`✂️  Split code into ${splitDocs.length} searchable chunks.`);

  // 4. Store in memory and return the retriever
  const vectorStore = new MemoryVectorStore(embeddings);
  await vectorStore.addDocuments(splitDocs);
  
  console.log("🔍 Vector Store Ready!\n");
  
  // Return top 3 most relevant code chunks
  return vectorStore.asRetriever({ k: 3 });
}

// --- The Startup Wizard ---
console.log("=========================================");
console.log("🚀 Welcome to DevAI Copilot Setup");
console.log("=========================================\n");
console.log("Choose your AI Engine architecture:");
console.log("1. Fully Cloud [Default] (Gemini API - Fastest, Most Accurate)");
console.log("2. Fully Local (Ollama - Maximum Privacy)");
console.log("3. Hybrid (Manager: Gemini, Workers: Ollama)");
console.log("");
if (process.env.DEVAI_CONTEXT_PATH) {
  console.log(`📂 DEVAI_CONTEXT_PATH is set to: ${process.env.DEVAI_CONTEXT_PATH}`);
} else {
  console.log("💡 TIP: Set DEVAI_CONTEXT_PATH to target a specific project:");
  console.log("   export DEVAI_CONTEXT_PATH=/path/to/your/project\n");
}

// Note: Made this callback 'async' to await the retriever
rl.question("Enter 1, 2, or 3 (Press Enter for Default): ", async (choice) => {
  let config: DevAIModelConfig;

  // Build the retriever FIRST so we can inject it
  const myVectorStoreRetriever = await getRetriever(choice);

  if (choice === "2") {
    console.log("\n⚙️  Booting Fully Local Architecture...");
    const ollama = getOllamaModel();
    config = { managerModel: ollama, ragModel: ollama, reactModel: ollama, retriever: myVectorStoreRetriever };
  } else if (choice === "3") {
    console.log("\n⚙️  Booting Hybrid Architecture...");
    config = {
      managerModel: getGeminiModel(),
      ragModel: getOllamaModel(),
      reactModel: getOllamaModel(),
      retriever: myVectorStoreRetriever
    };
  } else {
    console.log("\n⚙️  Booting Fully Cloud Architecture...");
    const gemini = getGeminiModel();
    config = { managerModel: gemini, ragModel: gemini, reactModel: gemini, retriever: myVectorStoreRetriever };
  }

  // Compile the graph with the chosen configuration
  const graph = createDevAIGraph(config);
  
  // Start the actual chat loop
  startChatLoop(graph);
});

// --- The Main Chat Loop ---
function startChatLoop(graph: any) {
  console.log("✅ DevAI Copilot Initialized. Type 'exit' to quit.\n");

  // Create a unique thread ID for this specific terminal session
  const sessionId = crypto.randomUUID();
  const threadConfig = { configurable: { thread_id: sessionId } };

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      try {
        console.log("\n[DevAI is thinking...]\n");
        
        // We only send the NEW message. The checkpointer handles the history!
        // We also explicitly reset replyToUser so it doesn't leak between turns
        const stateUpdate = { messages: [new HumanMessage(input)], replyToUser: "" };
        
        // Pass the threadConfig into the streamEvents function
        const stream = await graph.streamEvents(stateUpdate, { 
          version: "v2",
          ...threadConfig 
        });

        for await (const event of stream) {
          // Provide visibility so the user doesn't think the CLI froze during local Ollama processing
          if (event.event === "on_chain_start") {
             if (event.name === "manager") {
                process.stdout.write("\n🧠 [Manager analyzing request...]\n");
             } else if (event.name === "chat") {
                process.stdout.write("\n💬 [Composing response...]\n\n");
             }
          }

          // Skip internal manager node streaming to avoid printing raw JSON
          if (event.event === "on_chat_model_stream" && event.metadata?.langgraph_node === "manager") continue;

          if (event.event === "on_chat_model_stream") {
            const chunk = event.data.chunk?.content;
            if (chunk && typeof chunk === "string") {
              process.stdout.write(chunk);
            }
          } else if (event.event === "on_tool_start") {
            console.log(`\nCalling tool: ${event.name}`);
          } else if (event.event === "on_tool_end") {
            const raw = event.data?.output;
            let output: string;
            if (typeof raw === 'string') {
              output = raw;
            } else if (raw?.content && typeof raw.content === 'string') {
              output = raw.content;
            } else if (raw?.kwargs?.content && typeof raw.kwargs.content === 'string') {
              output = raw.kwargs.content;
            } else {
              output = JSON.stringify(raw, null, 2);
            }
            console.log(`Tool Response:\n\`\`\`\n${output}\n\`\`\`\n`);
          } else if (event.event === "on_chat_model_end") {
            if (event.metadata?.langgraph_node !== "manager") {
              console.log("\n");
            }
          } else if (event.event === "on_chain_end" && event.name === "manager") {
            const reply = event.data?.output?.replyToUser;
            if (reply) {
              console.log(`\n🤖 DevAI: ${reply}\n`);
            }
          }
        }

        // --- Handle Human-In-The-Loop Interrupts ---
        const finalState = await graph.getState(threadConfig);
        const tasks = finalState.tasks || [];
        const isInterrupted = tasks.length > 0 && tasks[0].interrupts?.length > 0;
        
        if (isInterrupted) {
          const interruptPayload = tasks[0].interrupts[0].value;
          const toolCalls = interruptPayload.toolCalls || [];
          console.log(`\n⚠️  [HITL] Sensitive action requested: ${toolCalls.map((t: any) => t.name).join(", ")}`);
          
          rl.question("Do you approve this action? (Y/N): ", async (answer) => {
            if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
              console.log("\n✅ Action approved. Resuming execution...\n");
              
              // To resume, we send a Command to LangGraph through streamEvents
              const { Command } = await import("@langchain/langgraph");
              const resumeStream = await graph.streamEvents(
                new Command({ resume: true }), 
                { version: "v2", ...threadConfig }
              );
              
              // Handle the remainder of the graph
              for await (const resumeEvent of resumeStream) {
                 if (resumeEvent.event === "on_tool_start") {
                   console.log(`\n\n🔧 [Executing Approved Tool]: ${resumeEvent.name}...`);
                 }
              }
              console.log("\n-----------------------------------");
              askQuestion();
            } else {
              console.log("\n❌ Action denied. Resetting state.\n");
              // A real implementation might append an error to messages,
              // for now we just gracefully ask the next question and do NOT resume.
              console.log("\n-----------------------------------");
              askQuestion();
            }
          });
          return; // Skip normal question re-prompt
        }

      } catch (error) {
        console.error("\n❌ Error executing graph:", error);
      }

      console.log("\n-----------------------------------");
      askQuestion();
    });
  };

  askQuestion();
}