import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { validatePath } from "./path-validator.js";
import { logAuditEvent } from "./audit-log.js";
import { getErrorMessage } from "../utils/errors.js";
import { updateTrustEntry } from "./trust-store.js";

export function registerTrustAction(
  server: McpServer,
  name: "trust_file" | "untrust_file" | "trust_directory" | "untrust_directory",
  type: "file" | "directory",
  trusted: boolean,
): void {
  server.registerTool(
    name,
    {
      description: trusted
        ? `Trust an existing ${type}; trusted directories cover their descendants.`
        : `Remove the explicit trust record for an existing ${type}.`,
      inputSchema: z.object({
        path: z.string().min(1).describe(`Absolute ${type} path`),
      }),
    },
    async ({ path }) => {
      let safePath = path;
      try {
        safePath = await validatePath(path);
        await updateTrustEntry(safePath, type, trusted);
        await logAuditEvent({
          action: trusted ? "trust" : "untrust",
          path: safePath,
          status: "success",
        });
        return {
          content: [
            {
              type: "text" as const,
              text: trusted
                ? `Trusted ${type}: ${safePath}`
                : `Untrusted ${type}: ${safePath}`,
            },
          ],
        };
      } catch (error) {
        await logAuditEvent({
          action: trusted ? "trust" : "untrust",
          path: safePath,
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
