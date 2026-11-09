import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { logAuditEvent } from "../../security/audit-log.js";
import { getErrorMessage } from "../../utils/errors.js";

const execFileAsync = promisify(execFile);

type CaptureMode = "screen" | "region" | "window";

const CAPTURE_COMMANDS: Record<
  CaptureMode,
  Array<{ command: string; args: (path: string) => string[] }>
> = {
  screen: [
    { command: "gnome-screenshot", args: (path) => ["-f", path] },
    { command: "scrot", args: (path) => [path] },
    { command: "import", args: (path) => ["-window", "root", path] },
  ],
  region: [
    { command: "gnome-screenshot", args: (path) => ["-a", "-f", path] },
    { command: "flameshot", args: (path) => ["gui", "--path", path] },
    { command: "scrot", args: (path) => ["-s", path] },
  ],
  window: [
    { command: "gnome-screenshot", args: (path) => ["-w", "-f", path] },
    { command: "scrot", args: (path) => ["-u", path] },
  ],
};

async function capture(mode: CaptureMode, outputPath: string): Promise<void> {
  const errors: string[] = [];
  for (const candidate of CAPTURE_COMMANDS[mode]) {
    try {
      await execFileAsync(candidate.command, candidate.args(outputPath), {
        timeout: 120_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      const image = await readFile(outputPath);
      if (image.length === 0)
        throw new Error("Screenshot command produced an empty image");
      return;
    } catch (error) {
      errors.push(`${candidate.command}: ${getErrorMessage(error)}`);
      await rm(outputPath, { force: true }).catch(() => undefined);
    }
  }
  throw new Error(
    `Unable to capture ${mode} screenshot. Install a supported Linux screenshot utility (gnome-screenshot, scrot, flameshot, or ImageMagick import) and ensure a desktop session is available. Attempts: ${errors.join(" | ")}`,
  );
}

function registerCaptureTool(
  server: McpServer,
  name: string,
  mode: CaptureMode,
  description: string,
): void {
  server.registerTool(
    name,
    {
      description,
      inputSchema: z.object({
        saveTo: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Optional absolute PNG path to save the screenshot inside an allowed filesystem root",
          ),
      }),
    },
    async ({ saveTo }) => {
      const tempPath = join(
        tmpdir(),
        `local-filesystem-mcp-${randomUUID()}.png`,
      );
      let finalPath = tempPath;
      let auditPath = `desktop:${mode}`;
      try {
        assertPermission("screenshot");
        if (saveTo) {
          finalPath = await validatePath(saveTo);
          if (!finalPath.toLowerCase().endsWith(".png")) {
            throw new Error("Screenshot save path must use the .png extension");
          }
          auditPath = finalPath;
        }

        await capture(mode, finalPath);
        const image = await readFile(finalPath);
        await logAuditEvent({
          action: "screenshot",
          path: auditPath,
          status: "success",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: saveTo
                ? `Screenshot captured and saved to: ${finalPath}`
                : `${mode} screenshot captured.`,
            },
            {
              type: "image" as const,
              data: image.toString("base64"),
              mimeType: "image/png",
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "screenshot",
          path: auditPath,
          status: "failure",
        });
        return {
          content: [{ type: "text" as const, text: getErrorMessage(error) }],
          isError: true,
        };
      } finally {
        if (!saveTo) await rm(tempPath, { force: true }).catch(() => undefined);
      }
    },
  );
}

export function registerScreenshotTools(server: McpServer): void {
  registerCaptureTool(
    server,
    "take_screenshot",
    "screen",
    "Capture the entire visible desktop and return the screenshot image.",
  );
  registerCaptureTool(
    server,
    "take_screenshot_region",
    "region",
    "Interactively select a screen region, capture it, and return the screenshot image.",
  );
  registerCaptureTool(
    server,
    "take_window_screenshot",
    "window",
    "Capture the active application window and return the screenshot image.",
  );
}
