import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import {
    mkdtemp,
    mkdir,
    writeFile,
    readFile,
    appendFile,
    copyFile,
    rename,
    unlink,
    rm,
    rmdir,
    readdir,
    stat,
} from 'node:fs/promises';

import { tmpdir } from "node:os";
import { join } from "node:path";

describe("📁 Filesystem Tests", () => {
    let testRoot: string;
    let testDir: string;
    let sourceFile: string;
    let destinationFile: string;

    before(async () => {
        testRoot = await mkdtemp(join(tmpdir(), "filesystem-mcp-test-"));

        testDir = join(testRoot, "files");
        await mkdir(testDir);

        sourceFile = join(testDir, "source.txt");
        destinationFile = join(testDir, "destination.txt");

        await writeFile(sourceFile, "Hello Filesystem!");
    });

    after(async () => {
        await rm(testRoot, { recursive: true, force: true });
    });

    it("should create a file", async () => {
        const filePath = join(testDir, "created.txt");

        await writeFile(filePath, "Created successfully");

        const content = await readFile(filePath, "utf-8");

        assert.equal(content, "Created successfully");
    });

    it("should read a file", async () => {
        const content = await readFile(sourceFile, "utf-8");

        assert.equal(content, "Hello Filesystem!");
    });

    it("should write file content", async () => {
        await writeFile(sourceFile, "Updated content");

        const content = await readFile(sourceFile, "utf-8");

        assert.equal(content, "Updated content");
    });

    it("should append content to a file", async () => {
        await appendFile(sourceFile, " Appended");

        const content = await readFile(sourceFile, "utf-8");

        assert.equal(content, "Updated content Appended");
    });

    it("should copy a file", async () => {
        await copyFile(sourceFile, destinationFile);

        const content = await readFile(destinationFile, "utf-8");

        assert.equal(content, "Updated content Appended");
    });

    it("should move a file", async () => {
        const movedFile = join(testDir, "moved.txt");

        await rename(destinationFile, movedFile);

        const content = await readFile(movedFile, "utf-8");

        assert.equal(content, "Updated content Appended");

        await assert.rejects(stat(destinationFile));
    });

    it("should list directory contents", async () => {
        const entries = await readdir(testDir);

        assert.ok(entries.includes("source.txt"));
        assert.ok(entries.includes("moved.txt"));
    });

    it("should get file information", async () => {
        const info = await stat(sourceFile);

        assert.equal(info.isFile(), true);
        assert.ok(info.size > 0);
    });

    it("should create a directory", async () => {
        const newDir = join(testDir, "new-folder");

        await mkdir(newDir);

        const info = await stat(newDir);

        assert.equal(info.isDirectory(), true);
    });

    it("should delete a file", async () => {
        const filePath = join(testDir, "delete-me.txt");

        await writeFile(filePath, "Temporary file");
        await unlink(filePath);

        await assert.rejects(stat(filePath));
    });

    it('should delete an empty directory', async () => {
        const emptyDir = join(testDir, 'empty-folder');

        await mkdir(emptyDir);
        await rmdir(emptyDir);

        await assert.rejects(stat(emptyDir));
    });
});
