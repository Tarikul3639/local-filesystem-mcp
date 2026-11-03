
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { stat } from "node:fs/promises";

import { logAuditEvent } from "../security/audit-log.js";
import { validatePath } from "../security/path-validator.js";
import { assertPermission } from "../security/permissions.js";
import { getErrorMessage } from "../utils/errors.js";

export function registerGetFileInfoTool(server: McpServer): void {
  server.registerTool(
    "get_file_info",
    {
      description: "Get information about a file or directory",
      inputSchema: z.object({
        path: z.string().min(1).describe("Absolute file or directory path"),
      }),
    },
    async ({ path }) => {
      let auditPath = path;

      try {
        assertPermission("read");

        const safePath = await validatePath(path);
        auditPath = safePath;

        const info = await stat(safePath);

        const result = {
          path: safePath,
          name: safePath.split("/").pop(),
          type: info.isDirectory() ? "directory" : "file",
          size: info.size,
          sizeInKB: Number((info.size / 1024).toFixed(2)),
          createdAt: info.birthtime.toISOString(),
          modifiedAt: info.mtime.toISOString(),
          accessedAt: info.atime.toISOString(),
          isFile: info.isFile(),
          isDirectory: info.isDirectory(),
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
              text: JSON.stringify(result, null, 2),
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
