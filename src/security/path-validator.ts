
import { lstat, realpath } from 'node:fs/promises';

import {
    basename,
    dirname,
    isAbsolute,
    relative,
    resolve,
    sep,
} from 'node:path';

import { ALLOWED_ROOTS } from '../config/paths.js';

/**
 * Check whether target is inside an allowed root.
 */
function isInsideRoot(target: string, root: string): boolean {
    const rel = relative(root, target);

    return (
        rel === '' ||
        (
            rel !== '..' &&
            !rel.startsWith(`..${sep}`) &&
            !isAbsolute(rel)
        )
    );
}

/**
 * Check whether an error is caused by a missing path.
 */
function isNotFoundError(error: unknown): boolean {
    return (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
    );
}

/**
 * Resolve and validate all configured allowed roots.
 */
async function getAllowedRoots(roots: string[]): Promise<string[]> {
    if (roots.length === 0) {
        throw new Error('No filesystem roots configured');
    }

    return Promise.all(
        roots.map(async (root) => {
            if (!isAbsolute(root)) {
                throw new Error(`Allowed root must be absolute: ${root}`);
            }

            return realpath(resolve(root));
        }),
    );
}

/**
 * Validate a filesystem path.
 *
 * Supports:
 * - Existing files
 * - Existing directories
 * - New files whose parent directory exists
 * - New directories whose parent directory exists
 *
 * Returns the canonical absolute path.
 */
export async function validatePath(
    inputPath: string,
    roots: string[] = ALLOWED_ROOTS,
): Promise<string> {
    // 1. Basic input validation
    if (
        typeof inputPath !== 'string' ||
        inputPath.trim().length === 0 ||
        inputPath.includes('\0')
    ) {
        throw new Error('Invalid path');
    }

    // 2. Absolute path validation
    if (!isAbsolute(inputPath)) {
        throw new Error('Absolute path required');
    }

    const target = resolve(inputPath);

    // 3. Resolve configured allowed roots
    const allowedRoots = await getAllowedRoots(roots);

    let safePath: string;

    try {
        // 4. Existing path: resolve symlinks
        await lstat(target);

        safePath = await realpath(target);
    } catch (error) {
        if (!isNotFoundError(error)) {
            throw error;
        }

        // 5. New path: validate its existing parent directory
        const parent = dirname(target);
        const fileName = basename(target);

        if (!fileName || fileName === '.' || fileName === '..') {
            throw new Error('Invalid destination path');
        }

        const safeParent = await realpath(parent);

        // Build destination using canonical parent path
        safePath = resolve(safeParent, fileName);
    }

    // 6. Check whether the canonical path is inside an allowed root
    const isAllowed = allowedRoots.some((root) =>
        isInsideRoot(safePath, root),
    );

    if (!isAllowed) {
        throw new Error(
            'Access denied: Path outside allowed directories',
        );
    }

    return safePath;
}
