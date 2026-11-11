import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { runCommand } from "../../security/command-runner.js";
import {
  getGitSubcommand,
  isGitExecutable,
} from "../../security/command-policy.js";
import { logAuditEvent } from "../../security/audit-log.js";
import { assertPermission } from "../../security/permissions.js";

export function registerRunCommandTool(server: McpServer): void {
  server.registerTool(
    "run_command",
    {
      description:
        "Run any executable inside an allowed working directory, except commands blocked by the security denylist",
      inputSchema: {
        command: z.string().trim().min(1).max(256),
        args: z.array(z.string()).default([]),
        workingDirectory: z.string().optional(),
        confirmed: z.boolean().default(false),
      },
    },
    async ({ command, args, workingDirectory, confirmed }) => {
      const auditPath = [
        workingDirectory ?? "(default directory)",
        command,
        ...args,
      ].join(" ");

      try {
        assertPermission("execute");

        const isGit = isGitExecutable(command);
        const gitSubcommand = isGit ? getGitSubcommand(args) : undefined;
        const requiresConfirmation =
          isGit &&
          [
            "add",
            "commit",
            "reset",
            "restore",
            "checkout",
            "switch",
            "merge",
            "rebase",
            "cherry-pick",
            "revert",
            "pull",
            "stash",
          ].includes(gitSubcommand ?? "");

        if (requiresConfirmation && !confirmed) {
          return {
            content: [
              {
                type: "text" as const,
                text: "This command requires user confirmation.",
              },
            ],
            isError: true,
          };
        }

        const result = await runCommand(command, args, workingDirectory);

        await logAuditEvent({
          action: "execute",
          path: auditPath,
          status: result.exitCode === 0 ? "success" : "failure",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: result.exitCode !== 0,
        };
      } catch (error) {
        await logAuditEvent({
          action: "execute",
          path: auditPath,
          status: "failure",
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                error instanceof Error
                  ? error.message
                  : "Command execution failed.",
            },
          ],
          isError: true,
        };
      }
    },
  );
}
