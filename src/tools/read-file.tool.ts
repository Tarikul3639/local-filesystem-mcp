import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { readFile } from "node:fs/promises";

import { withAudit } from '../security/audit-log.js';
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
        async ({ path }) => withAudit("read", path, async (setValidatedPath) => {
            try {
                // Check read permission
                assertPermission("read");

                // Validate file path
                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                // Read file content
                const content = await readFile(safePath, "utf-8");

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: content,
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
