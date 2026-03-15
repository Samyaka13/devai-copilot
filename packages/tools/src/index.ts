import { readFileTool, writeFileTool, listDirectoryTool } from "./fs.js";
import { gitStatusTool, gitDiffTool } from "./git.js";

// Export individual tools if needed
export * from "./fs.js";
export * from "./git.js";

// Export standard arrays of tools for our agents to consume easily
export const fileSystemTools = [readFileTool, writeFileTool, listDirectoryTool];
export const devOpsTools = [gitStatusTool, gitDiffTool];
export const allTools = [...fileSystemTools, ...devOpsTools];