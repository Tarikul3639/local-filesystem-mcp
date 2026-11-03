import { mkdir, appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type AuditAction =
    | "read"
    | "write"
    | "append"
    | "edit"
    | "delete"
    | "copy"
    | "move"
    | "create_directory"
    | "delete_directory"
    | "search"
    | "set_permissions";

export type AuditStatus = "success" | "failure" | "denied";

export interface AuditEvent {
    action: AuditAction;
    path: string;
    status: AuditStatus;
}

const LOG_DIRECTORY = join(
    homedir(),
    ".local",
    "share",
    "local-filesystem-mcp",
);

const LOG_FILE = join(LOG_DIRECTORY, "audit.log");

export async function logAuditEvent(event: AuditEvent): Promise<void> {
    const record = {
        timestamp: new Date().toISOString(),
        ...event,
    };

    await mkdir(LOG_DIRECTORY, {
        recursive: true,
        mode: 0o700,
    });

    await appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, {
        encoding: "utf-8",
        mode: 0o600,
    });
}
