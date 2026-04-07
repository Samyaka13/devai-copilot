import { readFileTool, writeFileTool, listDirectoryTool } from "./fs.js";
import { gitStatusTool, gitDiffTool, gitCommitTool } from "./git.js";

// Export individual tools if needed
export * from "./fs.js";
export * from "./git.js";

// Export standard arrays of tools for our agents to consume easily
export const readOnlyTools = [readFileTool, listDirectoryTool];
export const fileSystemTools = [readFileTool, writeFileTool, listDirectoryTool];
export const devOpsTools = [gitStatusTool, gitDiffTool, gitCommitTool];
export const allTools = [...fileSystemTools, ...devOpsTools];