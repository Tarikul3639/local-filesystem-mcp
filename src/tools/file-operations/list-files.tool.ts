import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { readdir } from "node:fs/promises";

import { logAuditEvent } from "../../security/audit-log.js";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { getErrorMessage } from "../../utils/errors.js";

export function registerListFilesTool(server: McpServer): void {
  server.registerTool(
    "list_files",
    {
      description: "List files and directories",
      inputSchema: z.object({
        path: z.string().describe("Absolute directory path"),
      }),
    },
    async ({ path }) => {
      let safePath = path;

      try {
        assertPermission("read");

        safePath = await validatePath(path);

        const entries = await readdir(safePath, {
          withFileTypes: true,
        });

        const result = entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
        }));

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
          path: safePath,
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
