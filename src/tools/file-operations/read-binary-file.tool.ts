import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { readFile, stat } from "node:fs/promises";
import { extname, basename } from "node:path";

import { logAuditEvent } from "../../security/audit-log.js";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { getErrorMessage } from "../../utils/errors.js";

const MAX_BINARY_READ_BYTES = 100 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".json": "application/json",
  ".zip": "application/zip",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

export function registerReadBinaryFileTool(server: McpServer): void {
  server.registerTool(
    "read_binary_file",
    {
      description:
        "Read a binary file and return its Base64 content with metadata. Supports files up to 10 MiB; useful for transferring images and documents to other services.",
      inputSchema: z.object({
        path: z.string().min(1).describe("Absolute file path"),
        maxBytes: z
          .number()
          .int()
          .positive()
          .max(MAX_BINARY_READ_BYTES)
          .default(MAX_BINARY_READ_BYTES)
          .describe("Maximum permitted file size in bytes (up to 10 MiB)"),
      }),
    },
    async ({ path, maxBytes }) => {
      let auditPath = path;

      try {
        assertPermission("read");

        const safePath = await validatePath(path);
        auditPath = safePath;

        const info = await stat(safePath);
        if (!info.isFile()) throw new Error("Path must point to a regular file");
        if (info.size > maxBytes) {
          throw new Error(
            `File is too large: ${info.size} bytes; maxBytes is ${maxBytes}`,
          );
        }

        const buffer = await readFile(safePath);
        const name = basename(safePath);
        const result = {
          path: safePath,
          name,
          size: buffer.byteLength,
          mimeType: MIME_TYPES[extname(name).toLowerCase()] ?? "application/octet-stream",
          encoding: "base64",
          dataBase64: buffer.toString("base64"),
        };

        await logAuditEvent({
          action: "read",
          path: safePath,
          status: "success",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "read",
          path: auditPath,
          status: "failure",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: getErrorMessage(error),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
