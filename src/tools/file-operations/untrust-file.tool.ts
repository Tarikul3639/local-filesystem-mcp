import type { McpServer } from "@modelcontextprotocol/server";
import { registerTrustAction } from "../../security/register-trust-action.js";

export function registerUntrustFileTool(server: McpServer): void {
  registerTrustAction(server, "untrust_file", "file", false);
}
