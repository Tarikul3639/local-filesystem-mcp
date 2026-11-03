import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { chmod } from "node:fs/promises";

import { withAudit } from '../security/audit-log.js';
import { validatePath } from "../security/path-validator.js";
import { assertPermission } from "../security/permissions.js";
import { getErrorMessage } from "../utils/errors.js";

export function registerSetFilePermissionsTool(server: McpServer): void {
    server.registerTool(
        "set_file_permissions",
        {
            description: "Change file permissions using an octal mode",
            inputSchema: z.object({
                path: z.string().min(1),
                mode: z
                    .number()
                    .int()
                    .min(0)
                    .max(0o777)
                    .describe("Permission mode, for example 0o644 or decimal 420"),
            }),
        },
        async ({ path, mode }) => withAudit("set_permissions", path, async (setValidatedPath) => {
            try {
                assertPermission("write");

                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                await chmod(safePath, mode);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Permissions changed successfully to ${mode.toString(8)}: ${safePath}`,
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
