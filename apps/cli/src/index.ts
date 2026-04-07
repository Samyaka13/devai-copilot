import "dotenv/config"; // Loads the .env file for the Gemini API Key
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { createDevAIGraph, DevAIModelConfig } from "@devai/core";
import * as readline from "node:readline";

// New imports for the Codebase Loader
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";

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
  return new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    temperature: 0,
  });
}

function getOllamaModel() {
  return new ChatOllama({
    baseUrl: "http://localhost:11434",
    model: "llama3.1",
    temperature: 0,
  });
}

// --- The Semantic RAG Retriever ---
async function getRetriever() {
  console.log("\n📚 Loading and Indexing Codebase...");

  // 1. Initialize Embeddings (Translates code into searchable math)
  const embeddings = new OllamaEmbeddings({
    baseUrl: "http://localhost:11434",
    model: "nomic-embed-text",
  });

  // 2. Load the actual code files (Scanning the core package for this test)
  const loader = new DirectoryLoader(
    "../../packages/core/src", // Adjust this path to scan different folders
    {
      ".ts": (path) => new TextLoader(path),
      ".js": (path) => new TextLoader(path),
    }
  );
  
  const docs = await loader.load();
  console.log(`✅ Loaded ${docs.length} files from the codebase.`);

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
console.log("3. Hybrid (Manager: Gemini, Workers: Ollama)\n");

// Note: Made this callback 'async' to await the retriever
rl.question("Enter 1, 2, or 3 (Press Enter for Default): ", async (choice) => {
  let config: DevAIModelConfig;

  // Build the retriever FIRST so we can inject it
  const myVectorStoreRetriever = await getRetriever();

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
// --- The Main Chat Loop ---
function startChatLoop(graph: any) {
  console.log("✅ DevAI Copilot Initialized. Type 'exit' to quit.\n");

  // Create a unique thread ID for this specific terminal session
  const threadConfig = { configurable: { thread_id: "devai-cli-session" } };

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      try {
        console.log("\n[DevAI is thinking...]\n");
        
        // We only send the NEW message. The checkpointer handles the history!
        const stateUpdate = { messages: [new HumanMessage(input)] };
        
        // Pass the threadConfig into the streamEvents function
        const stream = await graph.streamEvents(stateUpdate, { 
          version: "v2",
          ...threadConfig 
        });

        for await (const event of stream) {
          if (event.event === "on_chat_model_stream") {
            const chunk = event.data.chunk?.content;
            if (chunk && typeof chunk === "string") {
              process.stdout.write(chunk);
            }
          } else if (event.event === "on_tool_start") {
            console.log(`\n\n🔧 [Executing Tool]: ${event.name}...`);
          } else if (event.event === "on_chat_model_end") {
            console.log("\n");
          }
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