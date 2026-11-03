
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

import { logAuditEvent } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerGetFileHashTool(server: McpServer): void {
    server.registerTool(
        'get_file_hash',
        {
            description: 'Calculate SHA-256 hash of a file',
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

                const hash = createHash('sha256');
                const stream = createReadStream(safePath);

                for await (const chunk of stream) {
                    hash.update(chunk);
                }

                const fileHash = hash.digest('hex');

                await logAuditEvent({
                    action: 'read',
                    path: safePath,
                    status: 'success',
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            path: safePath,
                            algorithm: 'SHA-256',
                            hash: fileHash,
                        }, null, 2),
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
