
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { withAudit } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerGetDirectorySizeTool(server: McpServer): void {
    server.registerTool(
        'get_directory_size',
        {
            description: 'Calculate total directory size in bytes',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
        },
        async ({ path }) => withAudit("read", path, async (setValidatedPath) => {
            try {
                assertPermission('read');

                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                async function calculateSize(directory: string): Promise<number> {
                    const entries = await readdir(directory, {
                        withFileTypes: true,
                    });

                    let totalSize = 0;

                    for (const entry of entries) {
                        const fullPath = join(directory, entry.name);

                        if (entry.isDirectory()) {
                            totalSize += await calculateSize(fullPath);
                        } else if (entry.isFile()) {
                            const info = await stat(fullPath);
                            totalSize += info.size;
                        }
                        // Symbolic links are skipped.
                    }

                    return totalSize;
                }

                const size = await calculateSize(safePath);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            path: safePath,
                            sizeInBytes: size,
                            sizeInKB: Number((size / 1024).toFixed(2)),
                            sizeInMB: Number((size / 1024 / 1024).toFixed(2)),
                        }, null, 2),
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
