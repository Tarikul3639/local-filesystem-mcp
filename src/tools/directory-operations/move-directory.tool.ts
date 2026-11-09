import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { lstat, rename } from "node:fs/promises";
import { sep } from "node:path";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { logAuditEvent } from "../../security/audit-log.js";
import { updateTrustPathAfterMove } from "../../security/trust-store.js";
import { getErrorMessage } from "../../utils/errors.js";

export function registerMoveDirectoryTool(server: McpServer): void {
  server.registerTool(
    "move_directory",
    {
      description:
        "Move a directory without deleting its contents. Existing destinations are never overwritten.",
      inputSchema: z.object({
        source: z.string().min(1).describe("Absolute source directory path"),
        destination: z
          .string()
          .min(1)
          .describe("Absolute destination directory path"),
      }),
    },
    async ({ source, destination }) => {
      let auditPath = `${source} -> ${destination}`;
      try {
        assertPermission("write");
        const safeSource = await validatePath(source);
        const safeDestination = await validatePath(destination);
        auditPath = `${safeSource} -> ${safeDestination}`;
        const sourceStat = await lstat(safeSource);
        if (!sourceStat.isDirectory())
          throw new Error("Source path is not a directory");
        if (
          safeDestination === safeSource ||
          safeDestination.startsWith(safeSource + sep)
        ) {
          throw new Error(
            "Cannot move a directory into itself or one of its descendants",
          );
        }
        try {
          await lstat(safeDestination);
          throw new Error("Destination already exists; refusing to overwrite");
        } catch (error) {
          if (!(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          ))
            throw error;
        }
        await rename(safeSource, safeDestination);
        await updateTrustPathAfterMove(safeSource, safeDestination);
        await logAuditEvent({
          action: "move",
          path: auditPath,
          status: "success",
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Directory moved successfully:\nFrom: ${safeSource}\nTo: ${safeDestination}`,
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "move",
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
