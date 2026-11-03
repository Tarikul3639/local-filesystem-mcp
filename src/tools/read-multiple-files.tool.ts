import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { readFile } from "node:fs/promises";

import { logAuditEvent } from "../security/audit-log.js";
import { validatePath } from "../security/path-validator.js";
import { assertPermission } from "../security/permissions.js";
import { getErrorMessage } from "../utils/errors.js";

export function registerReadMultipleFilesTool(server: McpServer): void {
    server.registerTool(
        "read_multiple_files",
        {
            description: "Read multiple text files at once",
            inputSchema: z.object({
                paths: z.array(z.string().min(1)).min(1).max(20),
            }),
        },
        async ({ paths }) => {
            try {
                assertPermission("read");

                const results = await Promise.all(
                    paths.map(async (path) => {
                        try {
                            const safePath = await validatePath(path);
                            const content = await readFile(safePath, "utf-8");

                            await logAuditEvent({
                                action: "read",
                                path: safePath,
                                status: "success",
                            });

                            return {
                                path: safePath,
                                content,
                                success: true,
                            };
                        } catch (error) {
                            return {
                                path,
                                error: getErrorMessage(error),
                                success: false,
                            };
                        }
                    }),
                );

                const failedResults = results.filter((result) => !result.success);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            } catch (error) {
                await logAuditEvent({
                    action: "read",
                    path: paths.join(", ").slice(0, 2048),
                    status: "denied",
                }).catch(() => {
                    console.error("[audit] Unable to write audit event.");
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
