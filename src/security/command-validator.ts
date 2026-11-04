import {
  COMMAND_ALLOWLIST,
  type AllowedCommand,
  type CommandDefinition,
} from './command-allowlist.js';

export function validateCommand(
  command: string,
  args: readonly string[],
): CommandDefinition {
  const definition = COMMAND_ALLOWLIST[command as AllowedCommand];

  if (!definition || !definition.validateArgs(args)) {
    throw new Error('Command is not allowed.');
  }

  return definition;
}
