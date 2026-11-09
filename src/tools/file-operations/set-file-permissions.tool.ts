import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { chmod } from "node:fs/promises";

import { logAuditEvent } from "../../security/audit-log.js";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { getErrorMessage } from "../../utils/errors.js";

export function registerSetFilePermissionsTool(server: McpServer): void {
  server.registerTool(
    "set_file_permissions",
    {
      description: "Change file permissions using an octal mode",
      inputSchema: z.object({
        path: z.string().min(1),
        mode: z
          .number()
          .int()
          .min(0)
          .max(0o777)
          .describe("Permission mode, for example 0o644 or decimal 420"),
      }),
    },
    async ({ path, mode }) => {
      let auditPath = path;

      try {
        assertPermission("write");

        const safePath = await validatePath(path);
        auditPath = safePath;

        await chmod(safePath, mode);

        await logAuditEvent({
          action: "set_permissions",
          path: safePath,
          status: "success",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Permissions changed successfully to ${mode.toString(8)}: ${safePath}`,
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "set_permissions",
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
