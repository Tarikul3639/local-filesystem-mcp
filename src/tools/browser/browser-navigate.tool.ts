import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  getBrowserPage,
  runBrowserTool,
  validateWebUrl,
} from "./browser-context.js";

export function registerBrowserNavigateTool(server: McpServer): void {
  server.registerTool(
    "browser_navigate",
    {
      description:
        "Open an HTTP or HTTPS webpage in the persistent headless Chromium browser.",
      inputSchema: z.object({
        url: z.string().url(),
        waitUntil: z
          .enum(["load", "domcontentloaded", "networkidle", "commit"])
          .default("domcontentloaded"),
      }),
    },
    async ({ url, waitUntil }) =>
      runBrowserTool(
        url,
        async () => {
          const target = validateWebUrl(url);
          const currentPage = await getBrowserPage();
          await currentPage.goto(target.toString(), {
            waitUntil,
            timeout: 30_000,
          });
          return { title: await currentPage.title(), url: currentPage.url() };
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );
}
