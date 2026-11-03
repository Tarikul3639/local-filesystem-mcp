import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { logAuditEvent, type AuditStatus } from "../security/audit-log.js";
import { validatePath } from "../security/path-validator.js";

async function logCurrentDirectoryAuditEvent(
    path: string,
    status: AuditStatus,
): Promise<void> {
    try {
        await logAuditEvent({
            action: "read",
            path,
            status,
        });
    } catch {
        console.error("Failed to write audit event for get_current_directory");
    }
}

export function registerGetCurrentDirectoryTool(server: McpServer): void {
    server.registerTool(
        "get_current_directory",
        {
            description:
                "Get the server process working directory if it is within a configured filesystem root",
            inputSchema: z.object({}),
        },
        async () => {
            let requestedPath = "current working directory";

            try {
                requestedPath = process.cwd();
                const currentDirectory = await validatePath(requestedPath);
                await logCurrentDirectoryAuditEvent(currentDirectory, "success");

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: currentDirectory,
                        },
                    ],
                };
            } catch (error) {
                const status: AuditStatus =
                    error instanceof Error &&
                    error.message.startsWith("Access denied:")
                        ? "denied"
                        : "failure";
                await logCurrentDirectoryAuditEvent(requestedPath, status);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "The server's current directory is outside the configured filesystem roots or is unavailable.",
                        },
                    ],
                    isError: true,
                };
            }
        },
    );
}
