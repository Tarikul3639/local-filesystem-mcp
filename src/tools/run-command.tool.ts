import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { ALLOWED_COMMAND_NAMES } from '../security/command-allowlist.js';
import { runCommand } from '../security/command-runner.js';
import { logAuditEvent } from '../security/audit-log.js';
import { assertPermission } from '../security/permissions.js';

export function registerRunCommandTool(server: McpServer): void {
    server.registerTool(
        'run_command',
        {
            description: 'Run commands from the project command allowlist',
            inputSchema: {
                command: z.enum(ALLOWED_COMMAND_NAMES),
                args: z.array(z.string()).default([]),
                confirmed: z.boolean().default(false),
            },
        },
        async ({ command, args, confirmed }) => {
            const auditPath = [command, ...args].join(' ');

            try {
                assertPermission('execute');

                const requiresConfirmation =
                    command === 'git' &&
                    (args[0] === 'add' || args[0] === 'commit');

                if (requiresConfirmation && !confirmed) {
                    return {
                        content: [{
                            type: 'text' as const,
                            text: 'This command requires user confirmation.',
                        }],
                        isError: true,
                    };
                }

                const result = await runCommand(command, args);

                await logAuditEvent({
                    action: 'execute',
                    path: auditPath,
                    status: result.exitCode === 0 ? 'success' : 'failure',
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify(result, null, 2),
                    }],
                    isError: result.exitCode !== 0,
                };
            } catch (error) {
                await logAuditEvent({
                    action: 'execute',
                    path: auditPath,
                    status: 'failure',
                });

                return {
                    content: [{
                        type: 'text' as const,
                        text: error instanceof Error
                            ? error.message
                            : 'Command execution failed.',
                    }],
                    isError: true,
                };
            }
        },
    );
}
