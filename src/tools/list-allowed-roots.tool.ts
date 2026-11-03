import { realpath } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { ALLOWED_ROOTS } from "../config/paths.js";
import { logAuditEvent, type AuditStatus } from "../security/audit-log.js";

async function logRootsAuditEvent(status: AuditStatus): Promise<void> {
    try {
        await logAuditEvent({
            action: "read",
            path: "configured filesystem roots",
            status,
        });
    } catch {
        console.error("Failed to write audit event for list_allowed_roots");
    }
}

export function registerListAllowedRootsTool(server: McpServer): void {
    server.registerTool(
        "list_allowed_roots",
        {
            description:
                "List the configured filesystem roots that this server allows tools to access",
            inputSchema: z.object({}),
        },
        async () => {
            try {
                const roots = await Promise.all(
                    ALLOWED_ROOTS.map((root) => realpath(root)),
                );
                await logRootsAuditEvent("success");

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: roots.join("\n"),
                        },
                    ],
                };
            } catch {
                await logRootsAuditEvent("failure");

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "Unable to resolve configured filesystem roots.",
                        },
                    ],
                    isError: true,
                };
            }
        },
    );
}
