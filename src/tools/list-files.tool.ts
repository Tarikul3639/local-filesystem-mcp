import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { readdir } from "node:fs/promises";

import { withAudit } from '../security/audit-log.js';
import { validatePath } from "../security/path-validator.js";
import { assertPermission } from "../security/permissions.js";
import { getErrorMessage } from "../utils/errors.js";

export function registerListFilesTool(server: McpServer): void {
    server.registerTool(
        "list_files",
        {
            description: "List files and directories",
            inputSchema: z.object({
                path: z.string().describe("Absolute directory path"),
            }),
        },
        async ({ path }) => withAudit("read", path, async (setValidatedPath) => {
            try {
                assertPermission("read");

                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                const entries = await readdir(safePath, {
                    withFileTypes: true,
                });

                const result = entries.map((entry) => ({
                    name: entry.name,
                    type: entry.isDirectory() ? "directory" : "file",
                }));

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
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
        }),
    );
}
