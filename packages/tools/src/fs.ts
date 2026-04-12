import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Returns the resolved root directory DevAI is allowed to operate in.
 */
function getAllowedRoot(): string {
  return process.env.DEVAI_CONTEXT_PATH 
    ? path.resolve(process.env.DEVAI_CONTEXT_PATH) 
    : process.cwd();
}

/**
 * Sanitizes the file path to prevent path traversal.
 * Resolves the path and ensures it's within the allowed root directory.
 */
function safePath(filePath: string): string {
  const root = getAllowedRoot();
  const resolvedPath = path.resolve(root, filePath);
  const relative = path.relative(root, resolvedPath);
  
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Access denied: ${filePath} is outside the allowed directory.`);
  }
  
  return resolvedPath;
}

// 1. Read File Tool
export const readFileTool = tool(
  async ({ filePath }) => {
    try {
      const absolutePath = safePath(filePath);
      const content = await fs.readFile(absolutePath, "utf-8");
      return content;
    } catch (error: any) {
      return `Error reading file ${filePath}: ${error.message}`;
    }
  },
  {
    name: "read_file",
    description: "Reads the contents of a file at the specified path.",
    schema: z.object({
      filePath: z.string().describe("The relative path to the file to read"),
    }),
  }
);

// 2. Write File Tool
export const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      const absolutePath = safePath(filePath);
      // Ensure the directory exists before writing
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, "utf-8");
      return `Successfully wrote to ${filePath}`;
    } catch (error: any) {
      return `Error writing to file ${filePath}: ${error.message}`;
    }
  },
  {
    name: "write_file",
    description: "Writes content to a file. Overwrites existing content.",
    schema: z.object({
      filePath: z.string().describe("The relative path to write to"),
      content: z.string().describe("The exact code or text to write into the file"),
    }),
  }
);

// 3. List Directory Tool
export const listDirectoryTool = tool(
  async ({ dirPath }) => {
    try {
      const absolutePath = safePath(dirPath);
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      
      const formattedEntries = entries.map((dirent) => 
        `${dirent.isDirectory() ? "[DIR]" : "[FILE]"} ${dirent.name}`
      ).join("\n");
      
      return formattedEntries || "Directory is empty.";
    } catch (error: any) {
      return `Error listing directory ${dirPath}: ${error.message}`;
    }
  },
  {
    name: "list_directory",
    description: "Lists all files and folders in a given directory.",
    schema: z.object({
      dirPath: z.string().describe("The relative directory path to list (use '.' for root)"),
    }),
  }
);

// 4. Search In Files Tool (Grep-like)
async function searchDir(currentPath: string, root: string, regex: RegExp, results: string[]) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    
    if (entry.isDirectory()) {
      // Skip common non-source directories to improve performance
      if (["node_modules", ".git", "dist", ".next", "out", "build"].includes(entry.name)) {
        continue;
      }
      await searchDir(fullPath, root, regex, results);
    } else {
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const lines = content.split("\n");
        
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            const relativePath = path.relative(root, fullPath);
            results.push(`${relativePath}:${index + 1}: ${line.trim()}`);
          }
        });
      } catch (_err) {
        // Skip files that cannot be read as text (binary, etc.)
        continue;
      }
    }
  }
}

export const searchInFilesTool = tool(
  async ({ pattern, dirPath }) => {
    try {
      const root = getAllowedRoot();
      const rootSearchPath = safePath(dirPath);
      const results: string[] = [];
      const regex = new RegExp(pattern, "i"); // Case-insensitive by default for better UX

      await searchDir(rootSearchPath, root, regex, results);
      
      if (results.length > 50) {
        return results.slice(0, 50).join("\n") + `\n... and ${results.length - 50} more matches.`;
      }
      
      return results.join("\n") || "No matches found.";
    } catch (error: any) {
      return `Error searching in directory ${dirPath}: ${error.message}`;
    }
  },
  {
    name: "search_in_files",
    description: "Recursively searches for a pattern within all files in a directory.",
    schema: z.object({
      pattern: z.string().describe("The text or regex pattern to search for"),
      dirPath: z.string().describe("The relative path of the directory to search in"),
    }),
  }
);