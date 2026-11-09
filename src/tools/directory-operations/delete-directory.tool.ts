import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { lstat, mkdir, rename } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

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

export function registerDeleteDirectoryTool(server: McpServer): void {
  server.registerTool(
    "delete_directory",
    {
      description:
        "Move a directory and all its contents into the .trash folder. Nothing is permanently deleted.",
      inputSchema: z.object({
        path: z
          .string()
          .min(1)
          .describe("Absolute path of the directory to move to Trash"),
      }),
    },
    async ({ path }) => {
      let auditPath = path;
      try {
        assertPermission("write");
        const safePath = await validatePath(path);
        auditPath = safePath;

        const stat = await lstat(safePath);
        if (!stat.isDirectory())
          throw new Error(
            "Only directories can be moved with delete_directory",
          );

        const roots = await Promise.all(
          ALLOWED_ROOTS.map((root) => validatePath(root)),
        );
        const root = roots.find((candidate) => isInside(safePath, candidate));
        if (!root)
          throw new Error(
            "Access denied: Directory is outside configured filesystem roots",
          );

        const relativePath = relative(root, safePath);
        if (!relativePath || relativePath === ".")
          throw new Error("Cannot move an allowed root into Trash");

        const trashRoot = resolve(root, ".trash");
        if (isInside(safePath, trashRoot))
          throw new Error("Directory is already inside the Trash folder");

        const destination = resolve(trashRoot, relativePath);
        if (!isInside(destination, trashRoot))
          throw new Error("Invalid Trash destination");

        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        const safeDestination = await validatePath(destination);

        try {
          await lstat(safeDestination);
          throw new Error(
            "An item with the same path already exists in Trash; refusing to overwrite it",
          );
        } catch (error) {
          if (!(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          ))
            throw error;
        }

        await rename(safePath, safeDestination);
        await updateTrustPathAfterMove(safePath, safeDestination);
        await logAuditEvent({
          action: "trash",
          path: `${safePath} -> ${safeDestination}`,
          status: "success",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Directory moved to Trash successfully:\nOriginal: ${safePath}\nTrash: ${safeDestination}`,
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: "trash",
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
