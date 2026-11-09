import { env } from "../config/env.js";

export type FsAction =
  | "read"
  | "write"
  | "append"
  | "edit"
  | "copy"
  | "move"
  | "create_directory"
  | "search"
  | "set_permissions"
  | "get_permissions"
  | "execute"
  | "screenshot"
  | "browser";

export function assertPermission(action: FsAction): void {
  if (
    ["write", "append", "edit", "copy", "move", "create_directory"].includes(
      action,
    ) &&
    env.FILESYSTEM_READ_ONLY
  ) {
    throw new Error("Write permission denied: filesystem is in read-only mode");
  }
}
