
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { unlink } from 'node:fs/promises';

import { logAuditEvent } from '../security/audit-log.js';
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
        async ({ path }) => {
            let auditPath = path;

            try {
                assertPermission('delete');

                const safePath = await validatePath(path);
                auditPath = safePath;

                await unlink(safePath);

                await logAuditEvent({
                    action: 'delete',
                    path: safePath,
                    status: 'success',
                });

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `File deleted successfully: ${safePath}`,
                        },
                    ],
                };
            } catch (error) {
                await logAuditEvent({
                    action: 'delete',
                    path: auditPath,
                    status: 'failure',
                });

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
        },
    );
}
