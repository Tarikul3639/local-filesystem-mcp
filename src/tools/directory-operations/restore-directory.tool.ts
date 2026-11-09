import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { lstat, rename } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { ALLOWED_ROOTS } from "../../config/paths.js";
import { logAuditEvent } from "../../security/audit-log.js";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { updateTrustPathAfterMove } from "../../security/trust-store.js";
import { getErrorMessage } from "../../utils/errors.js";

function isInside(target: string, root: string): boolean {
  const rel = relative(root, target);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep))
  );
}

export function registerRestoreDirectoryTool(server: McpServer): void {
  server.registerTool(
    "restore_directory",
    {
      description:
        "Restore a directory and all its contents from .trash to its original location.",
      inputSchema: z.object({
        path: z
          .string()
          .min(1)
          .describe("Absolute path of the directory inside a .trash folder"),
      }),
    },
    async ({ path }) => {
      let auditPath = path;
      try {
        assertPermission("write");
        const safePath = await validatePath(path);
        auditPath = safePath;

        const stat = await lstat(safePath);
        if (!stat.isDirectory()) {
          throw new Error("The supplied Trash item is not a directory");
        }

        const roots = await Promise.all(
          ALLOWED_ROOTS.map((allowedRoot) => validatePath(allowedRoot)),
        );

        let root: string | undefined;
        let trashRoot: string | undefined;

        for (const candidate of roots) {
          const candidateTrash = resolve(candidate, ".trash");
          if (
            isInside(safePath, candidateTrash) &&
            safePath !== candidateTrash
          ) {
            root = candidate;
            trashRoot = candidateTrash;
            break;
          }
        }

        if (!root || !trashRoot) {
          throw new Error(
            "The supplied path is not inside a configured .trash folder",
          );
        }

        const relativePath = relative(trashRoot, safePath);
        const destination = resolve(root, relativePath);

        if (!isInside(destination, root) || destination === root) {
          throw new Error("Invalid restore destination");
        }

        try {
          await lstat(destination);
          throw new Error(
            "The original location already exists; refusing to overwrite it",
          );
        } catch (error) {
          if (!(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          )) {
            throw error;
          }
        }

        // Restore parent directories first when restoring nested directories.
        const safeDestination = await validatePath(destination);
        await rename(safePath, safeDestination);
        await updateTrustPathAfterMove(safePath, safeDestination);

        await logAuditEvent({
          action: "restore",
          path: `${safePath} -> ${safeDestination}`,
          status: "success",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Directory restored successfully:\nFrom Trash: ${safePath}\nRestored to: ${safeDestination}`,
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "restore",
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
