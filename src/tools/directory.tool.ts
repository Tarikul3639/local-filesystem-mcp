
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { mkdir, rmdir } from 'node:fs/promises';

import { withAudit } from '../security/audit-log.js';
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
        async ({ path }) => withAudit('create_directory', path, async (setValidatedPath) => {
            try {
                assertPermission('write');

                // Validate parent directory before creating
                const safeParent = await validatePath(
                    path.substring(0, path.lastIndexOf('/')) || '/',
                );

                const directoryPath = `${safeParent}/${path.split('/').pop()}`;
                setValidatedPath(directoryPath);

                await mkdir(directoryPath);

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `Directory created successfully: ${directoryPath}`,
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

    server.registerTool(
        'delete_directory',
        {
            description: 'Delete an empty directory',
            inputSchema: z.object({
                path: z.string().min(1).describe('Absolute directory path to delete'),
            }),
        },
        async ({ path }) => withAudit('delete_directory', path, async (setValidatedPath) => {
            try {
                assertPermission('delete');

                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                await rmdir(safePath);

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `Directory deleted successfully: ${safePath}`,
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
