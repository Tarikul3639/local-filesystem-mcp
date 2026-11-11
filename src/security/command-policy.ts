import { basename } from "node:path";

export interface CommandPolicy {
  timeout: number;
  maxOutput: number;
}

/**
 * Commands that must never be started by run_command.
 * Keep names lowercase and include executable aliases where relevant.
 *
 * This is a denylist, not an OS sandbox: interpreters, package scripts and
 * other permitted programs may still perform operations internally.
 */
export const BLOCKED_COMMANDS = [
  // Privilege escalation and account/security administration
  "sudo",
  "su",
  "doas",
  "pkexec",
  "runuser",
  "setpriv",
  "passwd",
  "chpasswd",
  "useradd",
  "usermod",
  "userdel",
  "groupadd",
  "groupdel",

  // Destructive disk, filesystem and data operations
  "rm",
  "rmdir",
  "shred",
  "wipe",
  "wipefs",
  "mkfs",
  "mkfs.ext2",
  "mkfs.ext3",
  "mkfs.ext4",
  "mkfs.xfs",
  "mkfs.btrfs",
  "dd",
  "fdisk",
  "cfdisk",
  "sfdisk",
  "parted",
  "format",
  "diskpart",
  "blkdiscard",
  "cryptsetup",
  "mount",
  "umount",
  "eject",
  "poweroff",
  "reboot",
  "shutdown",
  "halt",
  "init",

  // Permission and ownership changes
  "chmod",
  "chown",
  "chgrp",
  "setfacl",
  "chattr",

  // Process and service control / persistence
  "kill",
  "killall",
  "pkill",
  "systemctl",
  "service",
  "launchctl",
  "crontab",
  "at",

  // Network access / remote execution and transfer
  "ssh",
  "sshd",
  "scp",
  "sftp",
  "rsync",
  "nc",
  "ncat",
  "netcat",
  "socat",
  "telnet",
  "ftp",
  "tftp",

  // Shells and general-purpose interpreters can bypass a command denylist.
  "sh",
  "bash",
  "dash",
  "zsh",
  "fish",
  "ksh",
  "csh",
  "tcsh",
  "pwsh",
  "powershell",
  "cmd",
  "command",
  "env",
  "xargs",
  "eval",
  "node",
  "nodejs",
  "deno",
  "bun",
  "python",
  "python2",
  "python3",
  "pypy",
  "ruby",
  "perl",
  "php",
  "lua",
  "osascript",

  // Git operations that can publish, alter configuration, or destructively rewrite data
  "git push",
  "git send-pack",
  "git receive-pack",
  "git daemon",
  "git upload-pack",
  "git credential",
  "git config",
  "git clean",
  "git rm",
  "git filter-branch",
  "git filter-repo",
  "git update-ref",
  "git-receive-pack",
  "git-send-pack",

  // Utility wrappers and container/virtualization launchers can hide blocked commands.
  "busybox",
  "toybox",
  "timeout",
  "nohup",
  "nice",
  "stdbuf",
  "setsid",
  "chroot",
  "unshare",
  "nsenter",
  "docker",
  "podman",
  "nerdctl",
  "lxc",
  "kubectl",
  "flatpak",
  "snap",
] as const;

const BLOCKED_GIT_SUBCOMMANDS = BLOCKED_COMMANDS
  .filter((entry) => entry.startsWith("git "))
  .map((entry) => entry.slice(4));

// Git aliases are arbitrary shell commands. Permit known built-in subcommands
// only, so a local alias such as "git p" cannot hide a push operation.
const SAFE_GIT_SUBCOMMANDS = new Set([
  "add", "am", "annotate", "apply", "archive", "bisect", "blame",
  "branch", "bundle", "cat-file", "check-attr", "check-ignore",
  "check-mailmap", "checkout", "cherry", "cherry-pick", "citool",
  "clean", "clone", "commit", "config", "describe", "diff",
  "diff-tree", "difftool", "fast-export", "fetch", "format-patch",
  "fsck", "gc", "grep", "gui", "hash-object", "help", "init",
  "instaweb", "log", "maintenance", "merge", "merge-base",
  "mergetool", "mv", "name-rev", "notes", "pack-objects",
  "pack-redundant", "pack-refs", "patch-id", "prune", "prune-packed",
  "pull", "range-diff", "rebase", "reflog", "remote", "repack",
  "replace", "request-pull", "rerere", "reset", "restore", "revert",
  "rev-list", "rev-parse", "rm", "shortlog", "show", "show-branch",
  "sparse-checkout", "stash", "status", "submodule", "switch",
  "tag", "worktree", "verify-commit", "verify-tag", "whatchanged",
]);

const DEFAULT_TIMEOUT = 120_000;
const DEFAULT_MAX_OUTPUT = 200 * 1024;

function executableName(command: string): string {
  return basename(command).toLowerCase().replace(/\\.(exe|cmd|bat)$/i, "");
}

export function isGitExecutable(command: string): boolean {
  return executableName(command) === "git";
}

export function getGitSubcommand(args: readonly string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;

    // Reject config injection and exec-path overrides that can change Git behavior.
    if (arg === "-c" || arg === "--config-env" || arg === "--exec-path") {
      return undefined;
    }

    if (arg === "-C" || arg === "--git-dir" || arg === "--work-tree") {
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) continue;
    return arg.toLowerCase();
  }

  return undefined;
}

export function isBlockedCommand(
  command: string,
  args: readonly string[] = [],
): boolean {
  const name = executableName(command);

  if (!name || BLOCKED_COMMANDS.includes(name as (typeof BLOCKED_COMMANDS)[number])) {
    return true;
  }

  const nestedGitIndex = args.findIndex((arg) => executableName(arg) === "git");
  if (nestedGitIndex >= 0) {
    const nestedSubcommand = getGitSubcommand(args.slice(nestedGitIndex + 1));
    if (
      !nestedSubcommand ||
      BLOCKED_GIT_SUBCOMMANDS.includes(
        nestedSubcommand as (typeof BLOCKED_GIT_SUBCOMMANDS)[number],
      )
    ) {
      return true;
    }
  }

  if (name === "git") {
    // Parse the actual subcommand, not every argument (commit messages may contain blocked words).
    const subcommand = getGitSubcommand(args);
    if (
      !subcommand ||
      BLOCKED_GIT_SUBCOMMANDS.includes(
        subcommand as (typeof BLOCKED_GIT_SUBCOMMANDS)[number],
      ) ||
      !SAFE_GIT_SUBCOMMANDS.has(subcommand)
    ) {
      return true;
    }
  }

  // Block find's direct deletion and arbitrary child-process execution options.
  if (
    name === "find" &&
    args.some((arg) =>
      ["-delete", "-exec", "-execdir", "-ok", "-okdir"].includes(arg),
    )
  ) {
    return true;
  }

  // Reject null bytes; shell interpretation is separately disabled in spawn().
  if (command.includes("\0") || args.some((arg) => arg.includes("\0"))) {
    return true;
  }

  return false;
}

export function validateCommand(
  command: string,
  args: readonly string[],
): CommandPolicy {
  if (
    !command.trim() ||
    command.length > 256 ||
    args.length > 256 ||
    args.some((arg) => arg.length > 16_384) ||
    isBlockedCommand(command, args)
  ) {
    throw new Error("Command is blocked by the security policy.");
  }

  return {
    timeout: DEFAULT_TIMEOUT,
    maxOutput: DEFAULT_MAX_OUTPUT,
  };
}

export function isAllowedCommand(
  command: string,
  args: readonly string[],
): boolean {
  try {
    validateCommand(command, args);
    return true;
  } catch {
    return false;
  }
}
