
import { env } from '../config/env.js';

export type FsAction = 'read' | 'write' | 'delete';

export function assertPermission(action: FsAction): void {
    if (action === 'write' && env.FILESYSTEM_READ_ONLY) {
        throw new Error('Write permission denied');
    }

    if (action === 'delete' && !env.FILESYSTEM_ALLOW_DELETE) {
        throw new Error('Delete permission denied');
    }
}
