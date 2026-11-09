import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getBrowserPage, runBrowserTool } from "./browser-context.js";

export function registerBrowserGetLinksTool(server: McpServer): void {
  server.registerTool(
    "browser_get_links",
    {
      description:
        "List links from the current webpage with visible text and absolute URLs.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ limit }) =>
      runBrowserTool(
        "links",
        async () =>
          (await getBrowserPage()).locator("a[href]").evaluateAll(
            (anchors: Element[], max: number) =>
              anchors.slice(0, max).map((anchor: Element) => ({
                text: (anchor.textContent ?? "")
                  .trim()
                  .replace(/\s+/g, " ")
                  .slice(0, 300),
                url: (anchor as HTMLAnchorElement).href,
              })),
            limit,
          ),
        (result) => JSON.stringify(result, null, 2),
      ),
  );
}
