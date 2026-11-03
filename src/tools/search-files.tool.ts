
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { withAudit } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerSearchFilesTool(server: McpServer): void {
    server.registerTool(
        'search_files',
        {
            description: 'Search for files and directories by name',
            inputSchema: z.object({
                path: z.string().min(1).describe('Absolute directory path to search'),
                query: z.string().min(1).describe('File or directory name to search for'),
            }),
        },
        async ({ path, query }) => withAudit("search", path, async (setValidatedPath) => {
            try {
                // Check read permission
                assertPermission('read');

                // Validate directory path
                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                const results: string[] = [];

                async function searchDirectory(directory: string): Promise<void> {
                    const entries = await readdir(directory, {
                        withFileTypes: true,
                    });

                    for (const entry of entries) {
                        const fullPath = join(directory, entry.name);

                        if (entry.name.toLowerCase().includes(query.toLowerCase())) {
                            results.push(fullPath);
                        }

                        // Search inside subdirectories
                        if (entry.isDirectory()) {
                            await searchDirectory(fullPath);
                        }
                    }
                }

                await searchDirectory(safePath);

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(results, null, 2),
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
