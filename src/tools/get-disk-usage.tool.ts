
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { statfs } from 'node:fs/promises';

import { withAudit } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerGetDiskUsageTool(server: McpServer): void {
    server.registerTool(
        'get_disk_usage',
        {
            description: 'Get filesystem disk usage information',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
        },
        async ({ path }) => withAudit("read", path, async (setValidatedPath) => {
            try {
                assertPermission('read');

                const safePath = await validatePath(path);
                setValidatedPath(safePath);
                const info = await statfs(safePath);

                const total = info.blocks * info.bsize;
                const free = info.bfree * info.bsize;
                const available = info.bavail * info.bsize;
                const used = total - free;

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            path: safePath,
                            totalBytes: total,
                            usedBytes: used,
                            freeBytes: free,
                            availableBytes: available,
                            usedPercentage: total > 0
                                ? Number((used / total * 100).toFixed(2))
                                : 0,
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
