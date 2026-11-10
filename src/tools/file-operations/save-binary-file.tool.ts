import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { writeFile } from "node:fs/promises";

import { logAuditEvent } from "../../security/audit-log.js";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { getErrorMessage } from "../../utils/errors.js";

export function registerSaveBinaryFileTool(server: McpServer): void {
  server.registerTool(
    "save_binary_file",
    {
      description:
        "Save any file type (images, PDFs, documents, audio, video, archives, etc.) from base64-encoded file bytes to an absolute local path inside an allowed filesystem root. The caller must provide the file bytes.",
      inputSchema: z.object({
        path: z.string().min(1).describe("Absolute destination file path"),
        base64Data: z
          .string()
          .min(1)
          .regex(
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
            "Invalid base64 data",
          )
          .refine(
            (value) => Buffer.from(value, "base64").length > 0,
            "File is empty",
          )
          .describe("Raw base64-encoded file bytes, without a data URL prefix"),
        overwrite: z
          .boolean()
          .default(false)
          .describe("Whether to replace an existing file"),
      }),
    },
    async ({ path, base64Data, overwrite }) => {
      let auditPath = path;
      try {
        assertPermission("write");
        const bytes = Buffer.from(base64Data, "base64");
        const safePath = await validatePath(path);
        auditPath = safePath;
        await writeFile(safePath, bytes, { flag: overwrite ? "w" : "wx" });
        await logAuditEvent({
          action: "write",
          path: safePath,
          status: "success",
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `File saved successfully: ${safePath} (${bytes.length} bytes)`,
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "write",
          path: auditPath,
          status: "failure",
        });
        return {
          content: [{ type: "text" as const, text: getErrorMessage(error) }],
          isError: true,
        };
      }
    },
  );
}
