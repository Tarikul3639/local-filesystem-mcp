import { lstat, realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { ALLOWED_ROOTS } from "../config/paths.js";
import { env } from "../config/env.js";

function isInsideRoot(target: string, root: string): boolean {
  const rel = relative(root, target);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  );
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function getAllowedRoots(roots: string[]): Promise<string[]> {
  if (roots.length === 0) throw new Error("No filesystem roots configured");
  return Promise.all(
    roots.map(async (root) => {
      if (!isAbsolute(root))
        throw new Error(`Allowed root must be absolute: ${root}`);
      return realpath(resolve(root));
    }),
  );
}

async function canonicalizePath(target: string): Promise<string> {
  try {
    await lstat(target);
    return realpath(target);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    const parent = await realpath(dirname(target));
    const fileName = basename(target);
    if (!fileName || fileName === "." || fileName === "..")
      throw new Error("Invalid destination path");
    return resolve(parent, fileName);
  }
}

function isEnvFile(path: string): boolean {
  const name = basename(path);
  return (
    /^\.env(?:\..+)?$/i.test(name) && name.toLowerCase() !== ".env.example"
  );
}

export async function validatePath(
  inputPath: string,
  roots: string[] = ALLOWED_ROOTS,
): Promise<string> {
  if (
    typeof inputPath !== "string" ||
    inputPath.trim().length === 0 ||
    inputPath.includes("\0")
  )
    throw new Error("Invalid path");
  if (!isAbsolute(inputPath)) throw new Error("Absolute path required");

  const safePath = await canonicalizePath(resolve(inputPath));
  const allowedRoots = await getAllowedRoots(roots);
  const matchingRoot = allowedRoots.find((root) =>
    isInsideRoot(safePath, root),
  );
  if (!matchingRoot)
    throw new Error("Access denied: Path outside allowed directories");

  if (env.FILESYSTEM_DENY_ROOT_ACCESS && safePath === matchingRoot)
    throw new Error(
      "Access denied: Access to the allowed root directory itself is disabled",
    );

  const blockedPaths = await Promise.all(
    env.FILESYSTEM_BLOCKED_PATHS.map(canonicalizePath),
  );
  if (blockedPaths.some((blocked) => isInsideRoot(safePath, blocked)))
    throw new Error(
      "Access denied: Path is blocked by FILESYSTEM_BLOCKED_PATHS",
    );

  if (!env.FILESYSTEM_ALLOW_ENV_FILES && isEnvFile(safePath))
    throw new Error(
      "Access denied: .env files are disabled; .env.example remains accessible",
    );

  return safePath;
}
