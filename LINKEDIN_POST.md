# LinkedIn Post Draft

I built **DevAI Copilot** — a multi-agent, state-machine-driven AI developer assistant focused on controllability, safety, and practical codebase intelligence. 🚀

Instead of relying on a single monolithic prompt, I designed it as a **LangGraph workflow** with specialized roles:
- 🧠 **Manager Agent** for strict task routing
- 🔍 **Semantic RAG Agent** for conceptual code understanding
- 📁 **File Explorer Agent** for read-only repository inspection
- 🛠️ **ReAct Agent** for execution tasks (file + git operations)
- 💬 **Chat Agent** for conversational interactions

One of my favorite parts: a built-in **Human-in-the-Loop (HITL)** gate.
When sensitive actions are requested (like file writes or git operations), execution pauses and asks for explicit user approval (`Y/N`) before continuing.

### Tech stack
- TypeScript Monorepo (apps + packages)
- LangGraph + LangChain
- Ollama (local models)
- Gemini option for cloud/hybrid orchestration
- In-memory semantic retrieval pipeline for code awareness

### Why I built this
I wanted to explore how to make AI coding assistants:
1. **Safer** (approval checkpoints)
2. **More transparent** (stateful graph transitions)
3. **More useful on real repos** (semantic retrieval + tool execution)

If you’re building agentic developer tools, I’d love to exchange ideas on orchestration patterns, safety boundaries, and production hardening.

#AI #AgenticAI #LangGraph #LangChain #DeveloperTools #DevOps #TypeScript #LLM #Ollama
