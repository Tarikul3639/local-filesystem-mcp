import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { readFile, writeFile } from "node:fs/promises";

import { logAuditEvent } from "../../security/audit-log.js";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { getErrorMessage } from "../../utils/errors.js";

export function registerEditFileTool(server: McpServer): void {
  server.registerTool(
    "edit_file",
    {
      description: "Replace specific text inside an existing file",
      inputSchema: z.object({
        path: z.string().min(1),
        oldText: z.string().min(1),
        newText: z.string(),
      }),
    },
    async ({ path, oldText, newText }) => {
      let auditPath = path;

      try {
        assertPermission("write");

        const safePath = await validatePath(path);
        auditPath = safePath;

        const original = await readFile(safePath, "utf-8");

        if (!original.includes(oldText)) {
          throw new Error("Target text not found in file");
        }

        const updated = original.replace(oldText, newText);

        await writeFile(safePath, updated, "utf-8");

        await logAuditEvent({
          action: "edit",
          path: safePath,
          status: "success",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `File edited successfully: ${safePath}`,
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "edit",
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
