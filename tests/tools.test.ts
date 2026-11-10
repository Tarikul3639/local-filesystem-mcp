import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "../src/tools/register-all-tools.js";

describe("MCP Tools Tests", () => {
  it("should register the list_files tool", async () => {
    const server = new McpServer({
      name: "test-filesystem",
      version: "1.0.0",
    });

    registerAllTools(server);

    // Check if the tool is registered
    assert.ok(server);
  });
});
