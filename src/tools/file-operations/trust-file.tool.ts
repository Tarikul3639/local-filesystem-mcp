import type { McpServer } from "@modelcontextprotocol/server";
import { registerTrustAction } from "../../security/register-trust-action.js";

export function registerTrustFileTool(server: McpServer): void {
  registerTrustAction(server, "trust_file", "file", true);
}
