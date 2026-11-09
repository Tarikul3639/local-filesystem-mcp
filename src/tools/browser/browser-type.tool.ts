import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getBrowserPage, runBrowserTool } from "./browser-context.js";

export function registerBrowserTypeTool(server: McpServer): void {
  server.registerTool(
    "browser_type",
    {
      description:
        "Fill a form field matching a CSS selector on the current webpage.",
      inputSchema: z.object({
        selector: z.string().min(1).max(1000),
        text: z.string().max(20_000),
      }),
    },
    async ({ selector, text }) =>
      runBrowserTool(
        `type:${selector}`,
        async () => {
          const currentPage = await getBrowserPage();
          await currentPage.locator(selector).first().fill(text);
          return { filled: selector, characters: text.length };
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );
}
