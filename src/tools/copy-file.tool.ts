
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { copyFile } from "node:fs/promises";

import { logAuditEvent } from "../security/audit-log.js";
import { validatePath } from "../security/path-validator.js";
import { assertPermission } from "../security/permissions.js";
import { getErrorMessage } from "../utils/errors.js";

export function registerCopyFileTool(server: McpServer): void {
  server.registerTool(
    "copy_file",
    {
      description: "Copy a file to another location",
      inputSchema: z.object({
        source: z.string().min(1).describe("Absolute source file path"),
        destination: z
          .string()
          .min(1)
          .describe("Absolute destination file path"),
      }),
    },
    async ({ source, destination }) => {
      let auditPath = `${source} -> ${destination}`;

      try {
        assertPermission("write");

        const safeSource = await validatePath(source);
        const safeDestination = await validatePath(destination);

        auditPath = `${safeSource} -> ${safeDestination}`;

        await copyFile(safeSource, safeDestination);

        await logAuditEvent({
          action: "copy",
          path: auditPath,
          status: "success",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `File copied successfully:\nFrom: ${safeSource}\nTo: ${safeDestination}`,
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "copy",
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
