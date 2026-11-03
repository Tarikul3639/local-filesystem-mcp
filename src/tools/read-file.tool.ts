
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { readFile } from "node:fs/promises";

import { logAuditEvent } from "../security/audit-log.js";
import { validatePath } from "../security/path-validator.js";
import { assertPermission } from "../security/permissions.js";
import { getErrorMessage } from "../utils/errors.js";

export function registerReadFileTool(server: McpServer): void {
    server.registerTool(
        "read_file",
        {
            description: "Read the contents of a text file",
            inputSchema: z.object({
                path: z.string().min(1).describe("Absolute file path"),
            }),
        },
        async ({ path }) => {
            let auditPath = path;

            try {
                assertPermission("read");

                const safePath = await validatePath(path);
                auditPath = safePath;

                const content = await readFile(safePath, "utf-8");

                await logAuditEvent({
                    action: "read",
                    path: safePath,
                    status: "success",
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: content,
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
