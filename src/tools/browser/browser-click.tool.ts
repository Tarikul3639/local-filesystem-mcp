import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getBrowserPage, runBrowserTool } from "./browser-context.js";

export function registerBrowserClickTool(server: McpServer): void {
  server.registerTool(
    "browser_click",
    {
      description:
        "Click the first element matching a CSS selector on the current webpage.",
      inputSchema: z.object({ selector: z.string().min(1).max(1000) }),
    },
    async ({ selector }) =>
      runBrowserTool(
        `click:${selector}`,
        async () => {
          const currentPage = await getBrowserPage();
          await currentPage.locator(selector).first().click();
          return {
            clicked: selector,
            url: currentPage.url(),
            title: await currentPage.title(),
          };
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );
}
