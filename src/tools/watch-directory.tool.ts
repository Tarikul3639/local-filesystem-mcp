
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { watch } from 'node:fs/promises';

import { logAuditEvent } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerWatchDirectoryTool(server: McpServer): void {
    server.registerTool(
        'watch_directory',
        {
            description: 'Watch a directory for filesystem changes',
            inputSchema: z.object({
                path: z.string().min(1),
                durationSeconds: z.number().int().min(1).max(60).default(10),
            }),
        },
        async ({ path, durationSeconds }) => {
            let auditPath = path;

            try {
                assertPermission('read');

                const safePath = await validatePath(path);
                auditPath = safePath;

                const controller = new AbortController();

                const timeout = setTimeout(
                    () => controller.abort(),
                    durationSeconds * 1000,
                );

                const events: {
                    eventType: string;
                    filename: string | null;
                }[] = [];

                try {
                    const watcher = watch(safePath, {
                        signal: controller.signal,
                    });

                    for await (const event of watcher) {
                        events.push({
                            eventType: event.eventType,
                            filename: event.filename?.toString() ?? null,
                        });
                    }
                } catch (error) {
                    if (
                        !(error instanceof Error) ||
                        error.name !== 'AbortError'
                    ) {
                        throw error;
                    }
                } finally {
                    clearTimeout(timeout);
                }

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
                            durationSeconds,
                            events,
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
