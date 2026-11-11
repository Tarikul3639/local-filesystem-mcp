import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

// Keep this security test deterministic even when the developer's .env overrides the default.
process.env.FILESYSTEM_DENY_ROOT_ACCESS = "true";

const { validatePath } = await import("../security/path-validator.js");

describe("🛡️ Filesystem Security Tests", () => {
  let testRoot: string;
  let allowedDir: string;
  let outsideDir: string;
  let testRoots: string[];

  before(async () => {
    testRoot = await mkdtemp(join(tmpdir(), "filesystem-mcp-test-"));

    allowedDir = join(testRoot, "allowed");
    outsideDir = join(testRoot, "outside");

    await mkdir(allowedDir);
    await mkdir(outsideDir);

    testRoots = [allowedDir];

    await writeFile(join(allowedDir, "test.txt"), "Hello Security Test!");

    await writeFile(join(outsideDir, "secret.txt"), "Private Data");
  });

  after(async () => {
    await rm(testRoot, {
      recursive: true,
      force: true,
    });
  });

  // 1. Existing file inside allowed directory
  it("should allow access inside an allowed directory", async () => {
    const filePath = join(allowedDir, "test.txt");

    const result = await validatePath(filePath, testRoots);

    assert.equal(result, filePath);
  });

  // 2. The configured root itself is blocked by default
  it("should block direct access to an allowed root", async () => {
    await assert.rejects(
      validatePath(allowedDir, testRoots),
      /Access to the allowed root directory itself is disabled/,
    );
  });

  it("should allow access to a child directory inside an allowed root", async () => {
    const childDir = join(allowedDir, "child");
    await mkdir(childDir);
    const result = await validatePath(childDir, testRoots);
    assert.equal(result, childDir);
  });

  // 3. Block outside directory
  it("should block access outside allowed directories", async () => {
    const filePath = join(outsideDir, "secret.txt");

    await assert.rejects(validatePath(filePath, testRoots), /Access denied/);
  });

  // 4. Reject relative paths
  it("should reject relative paths", async () => {
    await assert.rejects(
      validatePath("test.txt", testRoots),
      /Absolute path required/,
    );
  });

  // 5. Reject empty paths
  it("should reject empty paths", async () => {
    await assert.rejects(validatePath("", testRoots), /Invalid path/);
  });

  // 6. Reject whitespace-only paths
  it("should reject whitespace-only paths", async () => {
    await assert.rejects(validatePath("   ", testRoots), /Invalid path/);
  });

  // 7. Reject null-byte paths
  it("should reject null-byte paths", async () => {
    await assert.rejects(
      validatePath("invalid\0path", testRoots),
      /Invalid path/,
    );
  });

  // 8. Block path traversal
  it("should block path traversal attempts", async () => {
    const filePath = join(allowedDir, "..", "outside", "secret.txt");

    await assert.rejects(validatePath(filePath, testRoots), /Access denied/);
  });

  // 9. Allow a new file destination
  it("should allow a new file inside an allowed directory", async () => {
    const newFile = join(allowedDir, "new-file.txt");

    const result = await validatePath(newFile, testRoots);

    assert.equal(result, newFile);
  });

  // 10. Allow a new directory destination
  it("should allow a new directory inside an allowed directory", async () => {
    const newDirectory = join(allowedDir, "new-folder");

    const result = await validatePath(newDirectory, testRoots);

    assert.equal(result, newDirectory);
  });

  // 11. Block new file outside allowed directory
  it("should block a new file outside allowed directories", async () => {
    const newFile = join(outsideDir, "new-file.txt");

    await assert.rejects(validatePath(newFile, testRoots), /Access denied/);
  });

  // 12. Block symlinks pointing outside allowed directories
  it("should block symlinks pointing outside allowed directories", async () => {
    const linkPath = join(allowedDir, "outside-link");

    await symlink(join(outsideDir, "secret.txt"), linkPath);

    await assert.rejects(validatePath(linkPath, testRoots), /Access denied/);
  });

  // 13. Reject missing parent directory
  it("should reject a new file when its parent directory does not exist", async () => {
    const newFile = join(allowedDir, "missing-folder", "new-file.txt");

    await assert.rejects(validatePath(newFile, testRoots));
  });

  // 14. Reject dotenv secrets but allow the example template
  it("should block .env files by default", async () => {
    const envPath = join(allowedDir, ".env");
    await writeFile(envPath, "SECRET=value");
    await assert.rejects(
      validatePath(envPath, testRoots),
      /\.env files are disabled/,
    );
  });

  it("should allow .env.example", async () => {
    const examplePath = join(allowedDir, ".env.example");
    await writeFile(examplePath, "EXAMPLE=value");
    assert.equal(await validatePath(examplePath, testRoots), examplePath);
  });

  // 15. Reject when no allowed roots are configured
  it("should reject empty allowed roots", async () => {
    await assert.rejects(
      validatePath(join(allowedDir, "test.txt"), []),
      /No filesystem roots configured/,
    );
  });
});
