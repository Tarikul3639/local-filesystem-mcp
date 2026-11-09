import { serveStdio } from "@modelcontextprotocol/server/stdio";
import type { McpServer } from "@modelcontextprotocol/server";

export async function startStdioTransport(server: McpServer): Promise<void> {
  serveStdio(() => server);
}
