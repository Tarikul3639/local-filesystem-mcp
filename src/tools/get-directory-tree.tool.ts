
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { withAudit } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerGetDirectoryTreeTool(server: McpServer): void {
    server.registerTool(
        'get_directory_tree',
        {
            description: 'Get recursive directory tree',
            inputSchema: z.object({
                path: z.string().min(1),
                maxDepth: z.number().int().min(1).max(10).default(5),
            }),
        },
        async ({ path, maxDepth }) => withAudit("read", path, async (setValidatedPath) => {
            try {
                assertPermission('read');

                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                async function buildTree(
                    directory: string,
                    depth: number,
                ): Promise<object[]> {
                    if (depth > maxDepth) return [];

                    const entries = await readdir(directory, {
                        withFileTypes: true,
                    });

                    const result: object[] = [];

                    for (const entry of entries) {
                        const item = {
                            name: entry.name,
                            type: entry.isDirectory()
                                ? 'directory'
                                : entry.isFile()
                                    ? 'file'
                                    : 'other',
                            children: [] as object[],
                        };

                        // Do not follow symbolic links.
                        if (entry.isDirectory()) {
                            item.children = await buildTree(
                                join(directory, entry.name),
                                depth + 1,
                            );
                        }

                        result.push(item);
                    }

                    return result;
                }

                const tree = await buildTree(safePath, 1);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(tree, null, 2),
                    }],
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: getErrorMessage(error),
                    }],
                    isError: true,
                };
            }
        }),
    );
}
