import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// 1. Read File Tool
export const readFileTool = tool(
  async ({ filePath }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
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
      const absolutePath = path.resolve(process.cwd(), filePath);
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
      const absolutePath = path.resolve(process.cwd(), dirPath);
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