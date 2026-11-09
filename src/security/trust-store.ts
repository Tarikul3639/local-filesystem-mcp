import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type TrustEntry = {
  path: string;
  type: "file" | "directory";
  trustedAt: string;
};

const STORE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../logs",
);
const STORE = resolve(STORE_DIR, "trust-store.json");

export async function readTrustStore(): Promise<TrustEntry[]> {
  try {
    const value: unknown = JSON.parse(await readFile(STORE, "utf8"));
    return Array.isArray(value) ? (value as TrustEntry[]) : [];
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return [];
    throw error;
  }
}

export async function saveTrustStore(entries: TrustEntry[]): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true, mode: 0o700 });
  const temp = `${STORE}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(entries, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temp, STORE);
}

function isWithin(child: string, parent: string): boolean {
  return (
    child === parent ||
    child.startsWith(parent.endsWith(sep) ? parent : parent + sep)
  );
}

export async function updateTrustPathAfterMove(
  source: string,
  destination: string,
): Promise<void> {
  const entries = await readTrustStore();
  await saveTrustStore(
    entries.map((entry) =>
      entry.path === source ||
      (entry.type === "directory" && isWithin(entry.path, source))
        ? { ...entry, path: destination + entry.path.slice(source.length) }
        : entry,
    ),
  );
}

export async function updateTrustEntry(
  path: string,
  type: "file" | "directory",
  trusted: boolean,
): Promise<void> {
  const stat = await lstat(path);
  if (type === "file" ? !stat.isFile() : !stat.isDirectory()) {
    throw new Error(`Path is not a regular ${type}`);
  }
  const entries = await readTrustStore();
  const filtered = entries.filter(
    (entry) => !(entry.path === path && entry.type === type),
  );
  if (trusted)
    filtered.push({ path, type, trustedAt: new Date().toISOString() });
  await saveTrustStore(filtered);
}
