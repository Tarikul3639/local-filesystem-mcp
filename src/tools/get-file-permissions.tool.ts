
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { stat } from 'node:fs/promises';

import { logAuditEvent } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerGetFilePermissionsTool(server: McpServer): void {
    server.registerTool(
        'get_file_permissions',
        {
            description: 'Get file permissions',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
        },
        async ({ path }) => {
            let auditPath = path;

            try {
                assertPermission('read');

                const safePath = await validatePath(path);
                auditPath = safePath;

                const info = await stat(safePath);
                const mode = info.mode & 0o777;

                const result = {
                    path: safePath,
                    mode: mode.toString(8).padStart(3, '0'),
                    owner: {
                        read: Boolean(mode & 0o400),
                        write: Boolean(mode & 0o200),
                        execute: Boolean(mode & 0o100),
                    },
                    group: {
                        read: Boolean(mode & 0o040),
                        write: Boolean(mode & 0o020),
                        execute: Boolean(mode & 0o010),
                    },
                    others: {
                        read: Boolean(mode & 0o004),
                        write: Boolean(mode & 0o002),
                        execute: Boolean(mode & 0o001),
                    },
                };

                await logAuditEvent({
                    action: 'read',
                    path: safePath,
                    status: 'success',
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(result, null, 2),
                    }],
                };
            } catch (error) {
                await logAuditEvent({
                    action: 'read',
                    path: auditPath,
                    status: 'failure',
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: getErrorMessage(error),
                    }],
                    isError: true,
                };
            }
        },
    );
}
