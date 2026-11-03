
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { unlink } from 'node:fs/promises';

import { withAudit } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerDeleteFileTool(server: McpServer): void {
    server.registerTool(
        'delete_file',
        {
            description: 'Delete a file from the filesystem',
            inputSchema: z.object({
                path: z.string().min(1).describe('Absolute file path to delete'),
            }),
        },
        async ({ path }) => withAudit("delete", path, async (setValidatedPath) => {
            try {
                // Check delete permission
                assertPermission('delete');

                // Validate file path
                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                // Delete file
                await unlink(safePath);

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `File deleted successfully: ${safePath}`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: getErrorMessage(error),
                        },
                    ],
                    isError: true,
                };
            }
        }),
    );
}
