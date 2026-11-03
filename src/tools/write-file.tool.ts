
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { writeFile } from 'node:fs/promises';

import { withAudit } from '../security/audit-log.js';
import { validatePath } from '../security/path-validator.js';
import { assertPermission } from '../security/permissions.js';
import { getErrorMessage } from '../utils/errors.js';

export function registerWriteFileTool(server: McpServer): void {
    server.registerTool(
        'write_file',
        {
            description: 'Create a new file or write content to an existing file',
            inputSchema: z.object({
                path: z.string().min(1).describe('Absolute file path'),
                content: z.string().describe('Content to write into the file'),
            }),
        },
        async ({ path, content }) => withAudit("write", path, async (setValidatedPath) => {
            try {
                // Check write permission
                assertPermission('write');

                // Validate file path
                const safePath = await validatePath(path);
                setValidatedPath(safePath);

                // Write content to file
                await writeFile(safePath, content, 'utf-8');

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `File written successfully: ${safePath}`,
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
