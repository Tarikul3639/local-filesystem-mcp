import type { McpServer } from "@modelcontextprotocol/server";
import { closeBrowserSession, runBrowserTool } from "./browser-context.js";

export function registerBrowserCloseTool(server: McpServer): void {
  server.registerTool(
    "browser_close",
    {
      description: "Close the current Chromium browser session.",
      inputSchema: {},
    },
    async () =>
      runBrowserTool("session:close", closeBrowserSession, (result) => result),
  );
}
