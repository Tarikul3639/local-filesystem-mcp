export interface CommandDefinition {
  executable: string;
  description: string;
  timeout: number;
  maxOutput: number;
  validateArgs: (args: readonly string[]) => boolean;
}

const GIT_COMMANDS = [
  ["status"],
  ["status", "--short"],
  ["status", "--porcelain"],
  ["diff"],
  ["diff", "--cached"],
  ["diff", "--stat"],
  ["diff", "--numstat"],
  ["diff", "--name-only", "--diff-filter=U"],
  ["diff", "--check"],
  ["log", "-5", "--oneline"],
  ["show", "-1", "--oneline"],
  ["branch", "--show-current"],
  ["branch", "--list"],
  ["ls-files"],
  ["rev-parse", "--show-toplevel"],
  ["add", "."],
];

const PNPM_COMMANDS = [
  ["run", "build"],
  ["run", "test"],
  ["run", "lint"],
  ["run", "typecheck"],
  ["build"],
  ["test"],
  ["exec", "nest", "build"],
  ["exec", "vitest", "run"],
  ["exec", "tsc", "--noEmit"],
  ["exec", "prisma", "validate"],
  ["exec", "prisma", "generate"],
];

const isValidCommit = (args: readonly string[]): boolean =>
  args.length === 3 &&
  args[0] === "commit" &&
  args[1] === "-m" &&
  typeof args[2] === "string" &&
  args[2].trim().length > 0 &&
  args[2].length <= 200;

const matchesExactCommand = (
  allowedCommands: string[][],
  args: readonly string[],
): boolean =>
  allowedCommands.some(
    (command) =>
      command.length === args.length &&
      command.every((arg, index) => arg === args[index]),
  );

export const COMMAND_ALLOWLIST = {
  ls: {
    executable: "ls",
    description: "List project files",
    timeout: 10_000,
    maxOutput: 50 * 1024,
    validateArgs: (args: readonly string[]) =>
      args.length === 0 ||
      (args.length === 1 &&
        args[0] !== undefined &&
        ["-a", "-l", "-la", "-al"].includes(args[0])),
  },
  pwd: {
    executable: "pwd",
    description: "Show the project working directory",
    timeout: 5_000,
    maxOutput: 4 * 1024,
    validateArgs: (args: readonly string[]) => args.length === 0,
  },
  git: {
    executable: "git",
    description: "Git operations",
    timeout: 15_000,
    maxOutput: 100 * 1024,
    validateArgs: (args: readonly string[]) =>
      matchesExactCommand(GIT_COMMANDS, args) || isValidCommit(args),
  },
  pnpm: {
    executable: "pnpm",
    description: "Run approved build, test, and validation scripts",
    timeout: 120_000,
    maxOutput: 200 * 1024,
    validateArgs: (args: readonly string[]) =>
      matchesExactCommand(PNPM_COMMANDS, args),
  },
} satisfies Record<string, CommandDefinition>;

export type AllowedCommand = keyof typeof COMMAND_ALLOWLIST;

export const ALLOWED_COMMAND_NAMES = Object.keys(COMMAND_ALLOWLIST) as [
  AllowedCommand,
  ...AllowedCommand[],
];

export function isAllowedCommand(
  command: string,
  args: readonly string[],
): boolean {
  const definition = COMMAND_ALLOWLIST[command as AllowedCommand];
  return definition?.validateArgs(args) ?? false;
}
