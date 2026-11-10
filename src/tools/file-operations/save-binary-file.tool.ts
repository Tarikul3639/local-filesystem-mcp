import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { createHash } from "node:crypto";
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
        "Receive a file transferred from an external/AI workspace and save its bytes to an absolute local path inside an allowed filesystem root. Use this when the source file path belongs to ChatGPT or another machine and cannot be accessed by copy_file. Send raw base64 bytes (not a data URL). There is no application-level file-size cap; practical limits are imposed by available memory, the MCP transport/client payload limit, and destination disk space. An optional SHA-256 checksum verifies integrity.",
      inputSchema: z.object({
        path: z.string().min(1).describe("Absolute destination file path"),
        base64Data: z
          .string()
          .min(4)
          .regex(
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
            "Invalid base64 data",
          )
          .describe("Raw base64-encoded file bytes, without a data URL prefix"),
        sha256: z
          .string()
          .regex(
            /^[a-fA-F0-9]{64}$/,
            "SHA-256 must be 64 hexadecimal characters",
          )
          .optional()
          .describe("Optional SHA-256 checksum of the original file bytes"),
        overwrite: z
          .boolean()
          .default(false)
          .describe("Whether to replace an existing file"),
      }),
    },
    async ({ path, base64Data, sha256, overwrite }) => {
      let auditPath = path;
      try {
        assertPermission("write");

        const bytes = Buffer.from(base64Data, "base64");
        if (bytes.length === 0) throw new Error("File is empty");
        // Reject non-canonical base64 instead of silently accepting truncated data.
        if (bytes.toString("base64") !== base64Data) {
          throw new Error("Invalid or non-canonical base64 data");
        }

        const actualSha256 = createHash("sha256").update(bytes).digest("hex");
        if (sha256 && actualSha256.toLowerCase() !== sha256.toLowerCase()) {
          throw new Error("SHA-256 checksum mismatch; file was not saved");
        }

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
              text: `File transferred and saved successfully: ${safePath} (${bytes.length} bytes, SHA-256: ${actualSha256})`,
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
