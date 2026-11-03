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

export type AuditError = "operation_failed" | "request_denied";

export interface AuditEvent {
    action: AuditAction;
    path: string;
    status: AuditStatus;
    error?: AuditError;
}

type AuditWriter = (event: AuditEvent) => Promise<void>;

const LOG_DIRECTORY = join(
    homedir(),
    ".local",
    "share",
    "local-filesystem-mcp",
);

const LOG_FILE = join(LOG_DIRECTORY, "audit.log");

function redactPath(path: string): string {
    return path
        .replace(/(api[-_]?key[-_]?)[^/]+/gi, "$1REDACTED")
        .replace(/sk-[a-zA-Z0-9_-]+/g, "REDACTED");
}

async function writeAuditEvent(event: AuditEvent): Promise<void> {
    await mkdir(LOG_DIRECTORY, {
        recursive: true,
        mode: 0o700,
    });

    await appendFile(
        LOG_FILE,
        `${JSON.stringify({
            timestamp: new Date().toISOString(),
            ...event,
        })}\n`,
        {
            encoding: "utf-8",
            mode: 0o600,
        },
    );
}

export async function logAuditEvent(
    event: AuditEvent,
    writer: AuditWriter = writeAuditEvent,
): Promise<void> {
    const safeEvent: AuditEvent = {
        ...event,
        path: redactPath(event.path),
    };

    try {
        await writer(safeEvent);
    } catch {
        console.error("[audit] Unable to write audit event.");
    }
}
