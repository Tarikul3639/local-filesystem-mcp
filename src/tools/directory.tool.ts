
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { mkdir, rmdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { logAuditEvent } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerDirectoryTool(server: McpServer): void {
    server.registerTool(
        'create_directory',
        {
            description: 'Create a directory',
            inputSchema: z.object({
                path: z.string().min(1).describe('Absolute directory path to create'),
            }),
        },
        async ({ path }) => {
            let auditPath = path;

            try {
                assertPermission('write');

                const safeParent = await validatePath(dirname(path));
                const directoryPath = join(safeParent, basename(path));

                auditPath = directoryPath;

                await mkdir(directoryPath);

                await logAuditEvent({
                    action: 'create_directory',
                    path: directoryPath,
                    status: 'success',
                });

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `Directory created successfully: ${directoryPath}`,
                        },
                    ],
                };
            } catch (error) {
                await logAuditEvent({
                    action: 'create_directory',
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

    server.registerTool(
        'delete_directory',
        {
            description: 'Delete an empty directory',
            inputSchema: z.object({
                path: z.string().min(1).describe('Absolute directory path to delete'),
            }),
        },
        async ({ path }) => {
            let auditPath = path;

            try {
                assertPermission('delete');

                const safePath = await validatePath(path);
                auditPath = safePath;

                await rmdir(safePath);

                await logAuditEvent({
                    action: 'delete_directory',
                    path: safePath,
                    status: 'success',
                });

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `Directory deleted successfully: ${safePath}`,
                        },
                    ],
                };
            } catch (error) {
                await logAuditEvent({
                    action: 'delete_directory',
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
