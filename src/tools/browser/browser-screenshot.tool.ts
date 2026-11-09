import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { writeFile } from "node:fs/promises";
import { getBrowserPage, runBrowserTool } from "./browser-context.js";
import { validatePath } from "../../security/path-validator.js";

export function registerBrowserScreenshotTool(server: McpServer): void {
  server.registerTool(
    "browser_screenshot",
    {
      description:
        "Capture the current browser viewport or full page as a high-resolution PNG, optionally saving it to an allowed filesystem path.",
      inputSchema: z.object({
        fullPage: z.boolean().default(false),
        saveTo: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Optional absolute PNG path inside an allowed filesystem root",
          ),
      }),
    },
    async ({ fullPage, saveTo }) =>
      runBrowserTool(
        saveTo ?? "screenshot",
        async () => {
          const currentPage = await getBrowserPage();
          const screenshot = Buffer.from(
            await currentPage.screenshot({
              fullPage,
              type: "png",
              scale: "device",
              animations: "disabled",
            }),
          );

          if (saveTo) {
            const outputPath = await validatePath(saveTo);
            if (!outputPath.toLowerCase().endsWith(".png")) {
              throw new Error(
                "Screenshot save path must use the .png extension",
              );
            }
            await writeFile(outputPath, screenshot, { flag: "wx" });
            return { savedTo: outputPath, bytes: screenshot.length };
          }

          return screenshot;
        },
        (result) => {
          if (Buffer.isBuffer(result)) return "Screenshot captured.";
          return `Screenshot captured and saved to: ${result.savedTo} (${result.bytes} bytes)`;
        },
        !saveTo,
      ),
  );
}
