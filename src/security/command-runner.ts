import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePath } from './path-validator.js';
import { validateCommand } from './command-validator.js';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Use this MCP project directory when no working directory is supplied.
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export async function runCommand(
  command: string,
  args: string[] = [],
  workingDirectory?: string,
): Promise<CommandResult> {
  const definition = validateCommand(command, args);

  // Custom directories must exist and remain inside configured filesystem roots.
  let cwd = PROJECT_ROOT;
  if (workingDirectory !== undefined) {
    cwd = await validatePath(workingDirectory);
    const directoryInfo = await stat(cwd);
    if (!directoryInfo.isDirectory()) {
      throw new Error('Working directory must be an existing directory.');
    }
  }

  return new Promise((resolvePromise, reject) => {
    const child = spawn(definition.executable, [...args], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let outputSize = 0;
    let timedOut = false;
    let outputLimitReached = false;

    const appendOutput = (target: 'stdout' | 'stderr', chunk: Buffer) => {
      outputSize += chunk.length;
      const remaining = definition.maxOutput - (
        Buffer.byteLength(stdout) + Buffer.byteLength(stderr)
      );

      if (remaining > 0) {
        const value = chunk.toString('utf8').slice(0, remaining);
        if (target === 'stdout') stdout += value;
        else stderr += value;
      }

      if (outputSize > definition.maxOutput && !outputLimitReached) {
        outputLimitReached = true;
        child.kill();
      }
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, definition.timeout);

    child.stdout.on('data', (chunk: Buffer) => appendOutput('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => appendOutput('stderr', chunk));

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(new Error('Command timed out.'));
        return;
      }
      if (outputLimitReached) {
        reject(new Error('Command output limit exceeded.'));
        return;
      }

      resolvePromise({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}
