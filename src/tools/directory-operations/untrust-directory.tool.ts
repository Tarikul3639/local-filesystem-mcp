import type { McpServer } from "@modelcontextprotocol/server";
import { registerTrustAction } from "../../security/register-trust-action.js";

export function registerUntrustDirectoryTool(server: McpServer): void {
  registerTrustAction(server, "untrust_directory", "directory", false);
}
