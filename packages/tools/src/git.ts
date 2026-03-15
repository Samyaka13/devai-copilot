import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// 1. Git Status Tool
export const gitStatusTool = tool(
  async () => {
    try {
      const { stdout } = await execAsync("git status --short");
      return stdout || "Working tree clean.";
    } catch (error: any) {
      return `Error executing git status: ${error.message}`;
    }
  },
  {
    name: "git_status",
    description: "Returns the current git status, showing modified, added, and deleted files.",
    schema: z.object({}), // No arguments needed
  }
);

// 2. Git Diff Tool
export const gitDiffTool = tool(
  async ({ filePath }) => {
    try {
      const command = filePath ? `git diff ${filePath}` : "git diff";
      const { stdout } = await execAsync(command);
      return stdout || "No unstaged changes.";
    } catch (error: any) {
      return `Error executing git diff: ${error.message}`;
    }
  },
  {
    name: "git_diff",
    description: "Shows changes between the working tree and the index. Optionally filter by file.",
    schema: z.object({
      filePath: z.string().optional().describe("Specific file to check diff for. Leave empty for all files."),
    }),
  }
);