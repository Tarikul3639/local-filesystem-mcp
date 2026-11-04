export interface CommandDefinition {
    executable: string;
    description: string;
    timeout: number;
    maxOutput: number;
    validateArgs: (args: readonly string[]) => boolean;
}

const GIT_COMMANDS = [
    ['status'],
    ['status', '--short'],
    ['status', '--porcelain'],
    ['diff'],
    ['diff', '--cached'],
    ['diff', '--stat'],
    ['diff', '--numstat'],
    ['diff', '--name-only', '--diff-filter=U'],
    ['diff', '--check'],
    ['log', '-5', '--oneline'],
    ['show', '-1', '--oneline'],
    ['branch', '--show-current'],
    ['branch', '--list'],
    ['ls-files'],
    ['rev-parse', '--show-toplevel'],
    ['add', '.'],
];

const isValidCommit = (args: readonly string[]): boolean =>
    args.length === 3 &&
    args[0] === 'commit' &&
    args[1] === '-m' &&
    typeof args[2] === 'string' &&
    args[2].trim().length > 0 &&
    args[2].length <= 200;

export const COMMAND_ALLOWLIST = {
    ls: {
        executable: 'ls',
        description: 'List project files',
        timeout: 10_000,
        maxOutput: 50 * 1024,
        validateArgs: (args: readonly string[]) =>
            args.length === 0 ||
            (args.length === 1 &&
                ['-a', '-l', '-la', '-al'].some((flag) => flag === args[0])),
    },

    pwd: {
        executable: 'pwd',
        description: 'Show the project working directory',
        timeout: 5_000,
        maxOutput: 4 * 1024,
        validateArgs: (args: readonly string[]) => args.length === 0,
    },

    git: {
        executable: 'git',
        description: 'Git operations',
        timeout: 15_000,
        maxOutput: 100 * 1024,
        validateArgs: (args: readonly string[]) =>
            GIT_COMMANDS.some(
                (command) =>
                    command.length === args.length &&
                    command.every((arg, index) => arg === args[index]),
            ) || isValidCommit(args),
    },
} satisfies Record<string, CommandDefinition>;

export type AllowedCommand = keyof typeof COMMAND_ALLOWLIST;

export const ALLOWED_COMMAND_NAMES = Object.keys(
    COMMAND_ALLOWLIST,
) as [AllowedCommand, ...AllowedCommand[]];

export function isAllowedCommand(
    command: string,
    args: readonly string[],
): boolean {
    const definition = COMMAND_ALLOWLIST[command as AllowedCommand];

    return definition?.validateArgs(args) ?? false;
}
