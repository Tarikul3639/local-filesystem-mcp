import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { appendFile } from "node:fs/promises";

import { logAuditEvent } from "../security/audit-log.js";
import { validatePath } from "../security/path-validator.js";
import { assertPermission } from "../security/permissions.js";
import { getErrorMessage } from "../utils/errors.js";

export function registerAppendFileTool(server: McpServer): void {
    server.registerTool(
        "append_file",
        {
            description: "Append content to the end of a file",
            inputSchema: z.object({
                path: z.string().min(1),
                content: z.string(),
            }),
        },
        async ({ path, content }) => {
            let safePath = path;

            try {
                assertPermission("write");

                safePath = await validatePath(path);

                await appendFile(safePath, content, "utf-8");

                await logAuditEvent({
                    action: "append",
                    path: safePath,
                    status: "success",
                }).catch(() => {
                    console.error("[audit] Unable to write audit event.");
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Content appended successfully: ${safePath}`,
                        },
                    ],
                };
            } catch (error) {
                const message = getErrorMessage(error);
                const denied = /permission denied|access denied/i.test(message);

                await logAuditEvent({
                    action: "append",
                    path: safePath,
                    status: denied ? "denied" : "failure",
                }).catch(() => {
                    console.error("[audit] Unable to write audit event.");
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: message,
                        },
                    ],
                    isError: true,
                };
            }
        },
    );
}
