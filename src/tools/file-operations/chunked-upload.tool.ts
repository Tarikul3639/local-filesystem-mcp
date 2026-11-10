import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  appendFile,
  link,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { logAuditEvent } from "../../security/audit-log.js";
import { validatePath } from "../../security/path-validator.js";
import { assertPermission } from "../../security/permissions.js";
import { getErrorMessage } from "../../utils/errors.js";

type UploadState = {
  id: string;
  destination: string;
  temporaryPath: string;
  expectedBytes: number;
  expectedChunks: number;
  expectedSha256: string;
  overwrite: boolean;
  nextChunk: number;
  receivedBytes: number;
  updatedAt: number;
};

const SESSION_DIR = join(tmpdir(), "local-filesystem-mcp-uploads");
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const transfers = new Map<string, UploadState>();

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function sessionPath(id: string): string {
  return join(SESSION_DIR, `${id}.json`);
}

async function saveState(state: UploadState): Promise<void> {
  state.updatedAt = Date.now();
  const target = sessionPath(state.id);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(state), {
    flag: "wx",
    mode: 0o600,
  });
  await rename(temporary, target);
  transfers.set(state.id, state);
}

async function loadState(id: string): Promise<UploadState> {
  const cached = transfers.get(id);
  if (cached) return cached;
  const raw = await readFile(sessionPath(id), "utf8");
  const state = JSON.parse(raw) as UploadState;
  if (
    state.id !== id ||
    !Number.isSafeInteger(state.expectedBytes) ||
    !Number.isSafeInteger(state.expectedChunks) ||
    !Number.isSafeInteger(state.nextChunk) ||
    !Number.isSafeInteger(state.receivedBytes) ||
    Date.now() - state.updatedAt > SESSION_TTL_MS
  ) {
    throw new Error("Upload session is invalid or expired");
  }
  // Revalidate both paths on every process-restored session before touching files.
  state.destination = await validatePath(state.destination);
  state.temporaryPath = await validatePath(state.temporaryPath);
  transfers.set(id, state);
  return state;
}

async function removeState(id: string): Promise<void> {
  transfers.delete(id);
  await rm(sessionPath(id), { force: true });
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function cleanupExpiredSessions(): Promise<void> {
  await mkdir(SESSION_DIR, { recursive: true, mode: 0o700 });
  const { readdir } = await import("node:fs/promises");
  for (const name of await readdir(SESSION_DIR)) {
    if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue;
    const file = join(SESSION_DIR, name);
    try {
      const info = await stat(file);
      if (Date.now() - info.mtimeMs <= SESSION_TTL_MS) continue;
      const state = JSON.parse(await readFile(file, "utf8")) as UploadState;
      if (state.id && state.temporaryPath) {
        try {
          const safeTemp = await validatePath(state.temporaryPath);
          await unlink(safeTemp).catch(() => undefined);
        } catch {
          /* Path may no longer be allowed; leave it untouched. */
        }
      }
      await rm(file, { force: true });
    } catch {
      /* Ignore malformed or inaccessible session records. */
    }
  }
}

export function registerChunkedUploadTools(server: McpServer): void {
  void cleanupExpiredSessions();

  server.registerTool(
    "begin_file_upload",
    {
      description:
        "Start a resumable chunked upload. There is no application-level total file-size or fixed chunk-size cap; the MCP client/transport may impose a per-call payload limit. Send sequential canonical base64 chunks and retain the transferId to resume after restart.",
      inputSchema: z.object({
        path: z.string().min(1),
        totalBytes: z.number().int().positive().safe(),
        totalChunks: z.number().int().positive().safe(),
        sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
        overwrite: z.boolean().default(false),
      }),
    },
    async ({ path, totalBytes, totalChunks, sha256, overwrite }) => {
      let auditPath = path;
      try {
        assertPermission("write");
        if (totalChunks > totalBytes) throw new Error("Invalid chunk count");
        const destination = await validatePath(path);
        auditPath = destination;
        await mkdir(SESSION_DIR, { recursive: true, mode: 0o700 });
        const id = randomUUID();
        const temporaryPath = join(
          dirname(destination),
          `.mcp-upload-${id}.part`,
        );
        await validatePath(temporaryPath);
        await writeFile(temporaryPath, Buffer.alloc(0), {
          flag: "wx",
          mode: 0o600,
        });
        await saveState({
          id,
          destination,
          temporaryPath,
          expectedBytes: totalBytes,
          expectedChunks: totalChunks,
          expectedSha256: sha256.toLowerCase(),
          overwrite,
          nextChunk: 0,
          receivedBytes: 0,
          updatedAt: Date.now(),
        });
        await logAuditEvent({
          action: "write",
          path: destination,
          status: "success",
        });
        return textResult(
          `Upload started. transferId=${id}; no app-level chunk cap; send indexes 0..${totalChunks - 1} sequentially.`,
        );
      } catch (error) {
        await logAuditEvent({
          action: "write",
          path: auditPath,
          status: "failure",
        });
        return { ...textResult(getErrorMessage(error)), isError: true };
      }
    },
  );

  server.registerTool(
    "write_file_chunk",
    {
      description:
        "Append one sequential base64 chunk to a resumable upload. No fixed application-level chunk-size cap; keep each request within your MCP client's payload limit. Send raw canonical base64, not a data URL.",
      inputSchema: z.object({
        transferId: z.string().uuid(),
        chunkIndex: z.number().int().nonnegative().safe(),
        base64Data: z
          .string()
          .min(4)
          .regex(
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
          ),
      }),
    },
    async ({ transferId, chunkIndex, base64Data }) => {
      try {
        assertPermission("write");
        const upload = await loadState(transferId);
        if (chunkIndex !== upload.nextChunk)
          throw new Error(
            `Unexpected chunk index; expected ${upload.nextChunk}`,
          );
        const bytes = Buffer.from(base64Data, "base64");
        if (bytes.length === 0 || bytes.toString("base64") !== base64Data) {
          throw new Error("Invalid or empty canonical base64 chunk");
        }
        if (upload.receivedBytes + bytes.length > upload.expectedBytes)
          throw new Error("Chunk exceeds declared total file size");
        await validatePath(upload.temporaryPath);
        await appendFile(upload.temporaryPath, bytes);
        upload.receivedBytes += bytes.length;
        upload.nextChunk += 1;
        await saveState(upload);
        return textResult(
          `Chunk ${chunkIndex} accepted (${bytes.length} bytes). Progress: ${upload.receivedBytes}/${upload.expectedBytes} bytes; ${upload.nextChunk}/${upload.expectedChunks} chunks.`,
        );
      } catch (error) {
        return { ...textResult(getErrorMessage(error)), isError: true };
      }
    },
  );

  server.registerTool(
    "get_file_upload_status",
    {
      description:
        "Get progress for an upload, including after restarting the MCP server.",
      inputSchema: z.object({ transferId: z.string().uuid() }),
    },
    async ({ transferId }) => {
      try {
        const upload = await loadState(transferId);
        return textResult(
          `Upload status: ${upload.receivedBytes}/${upload.expectedBytes} bytes; ${upload.nextChunk}/${upload.expectedChunks} chunks received; next chunk index=${upload.nextChunk}.`,
        );
      } catch (error) {
        return { ...textResult(getErrorMessage(error)), isError: true };
      }
    },
  );

  server.registerTool(
    "finish_file_upload",
    {
      description:
        "Verify chunk count, byte size, and SHA-256, then publish the completed file. Existing destinations are not replaced when overwrite=false.",
      inputSchema: z.object({ transferId: z.string().uuid() }),
    },
    async ({ transferId }) => {
      let auditPath = transferId;
      try {
        assertPermission("write");
        const upload = await loadState(transferId);
        auditPath = upload.destination;
        if (
          upload.nextChunk !== upload.expectedChunks ||
          upload.receivedBytes !== upload.expectedBytes
        ) {
          throw new Error(
            `Upload incomplete: received ${upload.nextChunk}/${upload.expectedChunks} chunks and ${upload.receivedBytes}/${upload.expectedBytes} bytes`,
          );
        }
        const destination = await validatePath(upload.destination);
        const temporaryPath = await validatePath(upload.temporaryPath);
        const actualSha256 = await hashFile(temporaryPath);
        if (actualSha256 !== upload.expectedSha256)
          throw new Error(
            "SHA-256 checksum mismatch; destination was not published",
          );
        if (upload.overwrite) await rename(temporaryPath, destination);
        else {
          await link(temporaryPath, destination);
          await unlink(temporaryPath);
        }
        await removeState(transferId);
        await logAuditEvent({
          action: "write",
          path: destination,
          status: "success",
        });
        return textResult(
          `Upload completed: ${destination} (${upload.receivedBytes} bytes, SHA-256: ${actualSha256})`,
        );
      } catch (error) {
        await logAuditEvent({
          action: "write",
          path: auditPath,
          status: "failure",
        });
        return { ...textResult(getErrorMessage(error)), isError: true };
      }
    },
  );

  server.registerTool(
    "abort_file_upload",
    {
      description:
        "Abort an active or resumed upload and remove its temporary staging file.",
      inputSchema: z.object({ transferId: z.string().uuid() }),
    },
    async ({ transferId }) => {
      try {
        assertPermission("write");
        const upload = await loadState(transferId);
        await unlink(await validatePath(upload.temporaryPath));
        await removeState(transferId);
        await logAuditEvent({
          action: "write",
          path: upload.destination,
          status: "success",
        });
        return textResult("Upload aborted and temporary file removed");
      } catch (error) {
        return { ...textResult(getErrorMessage(error)), isError: true };
      }
    },
  );
}
