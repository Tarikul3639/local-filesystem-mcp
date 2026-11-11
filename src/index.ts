import { McpServer } from "@modelcontextprotocol/server";
import { env } from "./config/env.js";
import { startStdioTransport } from "./transports/stdio.js";
import { startHttpTransport } from "./transports/http.js";
import { registerAllTools } from "./tools/register-all-tools.js";

const server = new McpServer({
  name: "local-filesystem-mcp",
  version: "1.2.0",
});
registerAllTools(server);
console.error("Local Filesystem MCP Server is starting...");
console.error(`Filesystem Roots: ${env.FILESYSTEM_ROOTS.join(", ")}`);
console.error(`Read-Only Mode: ${env.FILESYSTEM_READ_ONLY}`);
console.error("Permanent deletion tools: disabled");
console.error("Registered Tools: 48");
await startStdioTransport(server);
await startHttpTransport(server);
