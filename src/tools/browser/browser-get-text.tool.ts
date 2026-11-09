import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getBrowserPage, runBrowserTool } from "./browser-context.js";

export function registerBrowserGetTextTool(server: McpServer): void {
  server.registerTool(
    "browser_get_text",
    {
      description: "Extract visible text from the current webpage.",
      inputSchema: z.object({
        selector: z.string().min(1).max(1000).default("body"),
        maxCharacters: z.number().int().min(1).max(50_000).default(15_000),
      }),
    },
    async ({ selector, maxCharacters }) =>
      runBrowserTool(
        `text:${selector}`,
        async () =>
          (
            await (await getBrowserPage()).locator(selector).first().innerText()
          ).slice(0, maxCharacters),
        (result) => result,
      ),
  );
}
