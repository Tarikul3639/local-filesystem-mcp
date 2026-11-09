import type { McpServer } from "@modelcontextprotocol/server";
import { getBrowserPage, runBrowserTool } from "./browser-context.js";

export function registerBrowserGoBackTool(server: McpServer): void {
  server.registerTool(
    "browser_go_back",
    {
      description: "Navigate to the previous page in the current browser tab.",
      inputSchema: {},
    },
    async () =>
      runBrowserTool(
        "history:back",
        async () => {
          const currentPage = await getBrowserPage();
          await currentPage
            .goBack({ waitUntil: "domcontentloaded", timeout: 15_000 })
            .catch(() => null);
          return { url: currentPage.url(), title: await currentPage.title() };
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );
}
