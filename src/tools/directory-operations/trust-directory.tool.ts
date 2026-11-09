import type { McpServer } from "@modelcontextprotocol/server";
import { registerTrustAction } from "../../security/register-trust-action.js";

export function registerTrustDirectoryTool(server: McpServer): void {
  registerTrustAction(server, "trust_directory", "directory", true);
}
