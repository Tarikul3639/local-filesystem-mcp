# local-filesystem-mcp

`local-filesystem-mcp` is a local TypeScript Model Context Protocol (MCP) server. MCP is a protocol that lets AI applications discover and call tools exposed by a server. When connected to this server, a compatible assistant can list, inspect, read, and modify files within configured filesystem roots through those tools.

The server uses the MCP SDK v2 and currently runs over STDIO. Filesystem access is restricted by configured roots and permission settings. Review the security notes before enabling write or delete operations.

## Table of contents

- [Project overview](#project-overview)
- [Features](#features)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment configuration](#environment-configuration)
- [Running the MCP server](#running-the-mcp-server)
- [MCP Inspector](#mcp-inspector)
- [Connecting AI clients](#connecting-ai-clients)
- [Security](#security)
- [Testing](#testing)
- [Adding a new MCP tool](#adding-a-new-mcp-tool)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Project overview

An MCP server provides tools and other context to an MCP-compatible application using a standard protocol. This server exposes filesystem tools so an AI assistant can request operations on the machine running the server. The server itself does not decide which files an assistant should access; configured roots and permission checks constrain filesystem operations.

This is a local TypeScript application. It currently implements the MCP STDIO transport. The file `src/transports/http.ts` contains only commented-out code, so HTTP transport is not available.

## Features

The server registers 21 tools. Paths passed to filesystem tools must be absolute, and are checked against the configured roots.

### File operations

| Tool | Required inputs | Behavior |
| --- | --- | --- |
| `read_file` | `path` | Reads a text file as UTF-8. |
| `read_multiple_files` | `paths` | Reads 1–20 files and returns an individual result for each path. A failed item is represented in that item's result. |
| `write_file` | `path`, `content` | Creates a file or overwrites its contents with UTF-8 text. |
| `append_file` | `path`, `content` | Appends UTF-8 text to a file. |
| `edit_file` | `path`, `oldText`, `newText` | Replaces the first occurrence of `oldText` with `newText`. `oldText` must not be empty. |
| `delete_file` | `path` | Removes a file. Requires delete permission to be enabled. |
| `copy_file` | `source`, `destination` | Copies a file to the destination path. |
| `move_file` | `source`, `destination` | Moves or renames a file. |

### Directory operations

| Tool | Required inputs | Behavior |
| --- | --- | --- |
| `create_directory` | `path` | Creates one directory. Its parent directory must already exist. |
| `delete_directory` | `path` | Removes an empty directory. Requires delete permission to be enabled. |
| `get_current_directory` | None | Returns the server process's current working directory only if it is within a configured filesystem root. |
| `list_files` | `path` | Lists the immediate entries in a directory, including each entry's name and type. |
| `list_allowed_roots` | None | Lists the canonical filesystem roots configured for this server. Use one of these paths as the starting point for directory listing. |
| `get_directory_tree` | `path`; optional `maxDepth` | Returns a directory tree. `maxDepth` defaults to 5 and accepts values from 1 to 10. |
| `get_directory_size` | `path` | Recursively totals file sizes in a directory. Symlinks are skipped. |

### Search and inspection

| Tool | Required inputs | Behavior |
| --- | --- | --- |
| `search_files` | `path`, `query` | Recursively searches entry names for a case-insensitive substring. It does not search file contents. |
| `get_file_info` | `path` | Returns filesystem metadata including type, size, timestamps, and file/directory flags. |
| `get_file_hash` | `path` | Computes a SHA-256 hash for a file. |
| `get_disk_usage` | `path` | Reports filesystem total, used, free, and available space and the percentage used. |

### Permissions and monitoring

| Tool | Required inputs | Behavior |
| --- | --- | --- |
| `get_file_permissions` | `path` | Reports permission bits and read, write, and execute access for owner, group, and others. |
| `set_file_permissions` | `path`, `mode` | Changes mode bits. `mode` is an integer from 0 through `0o777` (for example, decimal `420` is `0o644`). |
| `watch_directory` | `path`; optional `durationSeconds` | Watches directory changes and returns event types and filenames. Duration defaults to 10 seconds and accepts values from 1 to 60. |

**Destructive operations:** `write_file` can overwrite an existing file; `delete_file` and `delete_directory` remove filesystem entries; `move_file` changes their location; and `set_file_permissions` changes access rights. Use read-only mode and keep delete permission disabled unless those operations are needed.

## Technology stack

Versions below come from the project manifest and lockfile. Dependency ranges use the versions declared by the project.

| Technology | Version |
| --- | --- |
| Node.js | 20 or newer (required by the MCP SDK dependency) |
| TypeScript | `^7.0.2` |
| pnpm | `12.16.1` |
| `@modelcontextprotocol/server` (MCP SDK v2) | `^2.4.0` |
| Zod | `^4.6.7` |

The project also uses `dotenv` (`^18.0.9`) to load `.env`, and `tsx` (`^4.23.15`) for development and tests.

## Project structure

```text
local-filesystem-mcp/
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   └── paths.ts
│   ├── security/
│   │   ├── audit-log.ts
│   │   ├── authentication.ts
│   │   ├── path-validator.ts
│   │   └── permissions.ts
│   ├── tools/
│   │   ├── append-file.tool.ts
│   │   ├── copy-file.tool.ts
│   │   ├── delete-file.tool.ts
│   │   ├── directory.tool.ts
│   │   ├── edit-file.tool.ts
│   │   ├── get-directory-size.tool.ts
│   │   ├── get-directory-tree.tool.ts
│   │   ├── get-current-directory.tool.ts
│   │   ├── get-disk-usage.tool.ts
│   │   ├── get-file-hash.tool.ts
│   │   ├── get-file-info.tool.ts
│   │   ├── get-file-permissions.tool.ts
│   │   ├── list-allowed-roots.tool.ts
│   │   ├── list-files.tool.ts
│   │   ├── move-file.tool.ts
│   │   ├── read-file.tool.ts
│   │   ├── read-multiple-files.tool.ts
│   │   ├── register-all-tools.ts
│   │   ├── search-files.tool.ts
│   │   ├── set-file-permissions.tool.ts
│   │   ├── watch-directory.tool.ts
│   │   └── write-file.tool.ts
│   ├── transports/
│   │   ├── http.ts
│   │   └── stdio.ts
│   ├── utils/
│   │   └── errors.ts
│   └── index.ts
├── tests/
│   ├── audit-log.test.ts
│   ├── filesystem.test.ts
│   ├── security.test.ts
│   └── tools.test.ts
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── LICENSE
└── README.md
```

`config/` parses environment settings and resolves allowed roots. `security/` contains path validation, permission checks, and the audit helper. `tools/` contains the 21 MCP tools and their central registrar. `transports/` contains the STDIO and HTTP transports. `utils/` contains shared error formatting. `index.ts` creates the MCP server, registers tools, and starts both transports. `tests/` contains the Node test-runner suites. The HTTP transport currently does not enforce its token authentication helper.

## Prerequisites

- Node.js 20 or newer.
- pnpm 12.16.1. The manifest declares this package manager version.
- Git, to clone the repository.

## Installation

Replace the placeholder with the repository URL provided by your project host:

```sh
git clone <repository-url> local-filesystem-mcp
cd local-filesystem-mcp
corepack enable
corepack prepare pnpm@12.16.1 --activate
pnpm install
```

Create a `.env` file in the project directory and configure the allowed roots as described below. Then build:

```sh
pnpm build
```

The package's current TypeScript configuration has known issues described in [Troubleshooting](#troubleshooting). A successful build should not be assumed until those are resolved.

## Environment configuration

`src/config/env.ts` loads these variables through `dotenv` and validates their values:

| Variable | Default | Meaning |
| --- | --- | --- |
| `FILESYSTEM_ROOTS` | The current user's home directory | One or more absolute filesystem roots the server may access. Roots are separated using the operating system's path delimiter (typically `:` on POSIX and `;` on Windows). Each configured root must exist. |
| `FILESYSTEM_READ_ONLY` | `false` | When `true`, operations checked as writes are denied. Reads remain available. |
| `FILESYSTEM_ALLOW_DELETE` | `false` | When `true`, file and directory deletion permission checks are allowed. |

Complete recommended `.env.example` contents for a POSIX system (replace the example paths with directories that exist on your machine):

```dotenv
FILESYSTEM_ROOTS=/absolute/path/to/allowed/directory:/absolute/path/to/another/directory
FILESYSTEM_READ_ONLY=true
FILESYSTEM_ALLOW_DELETE=false
```

Use `;` between roots on Windows. The roots are an allowlist: paths outside them are rejected after canonical path resolution. For an initial setup, prefer one dedicated directory and keep read-only mode enabled. Set `FILESYSTEM_READ_ONLY=false` only when file modifications are needed, and set `FILESYSTEM_ALLOW_DELETE=true` only when deletion is explicitly required.

The checked-in `.env.example` currently does **not** match `src/config/env.ts`: its variable names and defaults are stale, and it contains a machine-specific path. Do not copy it as authoritative configuration. Use the variable names and placeholder-only template above. This README intentionally does not reproduce local paths or secrets.

## Running the MCP server

The available package scripts are:

| Purpose | Command |
| --- | --- |
| Development with file watching | `pnpm dev` |
| Compile TypeScript into `dist/` | `pnpm build` |
| Run the built server | `pnpm start` |

The development command runs `tsx watch src/index.ts`. Production mode runs `node dist/index.js` and therefore requires a successful build first.

The active transport is STDIO: the client launches the server process and exchanges MCP messages over its standard input and output streams. Do not write ordinary logs to stdout because stdout carries protocol messages; application logs should go to stderr. The startup messages in `src/index.ts` use `console.error` for this reason. HTTP transport is not implemented, and there is no HTTP run command or server configuration to document.

## MCP Inspector

After dependencies are installed and the project builds, launch the Inspector against the built server:

```sh
npx @modelcontextprotocol/inspector node /absolute/path/to/local-filesystem-mcp/dist/index.js
```

Set the server's environment in the Inspector launch configuration if needed, including `FILESYSTEM_ROOTS`. The Inspector starts the command as a STDIO server and provides a UI for listing and calling its tools. See the [MCP SDK v2 server guide](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server) for the Inspector workflow.

## Connecting AI clients

These examples use the built entry point and an absolute project path placeholder. Build the project first, then replace `/absolute/path/to/local-filesystem-mcp` and the allowed directory with real absolute paths. Keep the same environment controls you would use when launching the server manually.

### Claude Desktop

Claude Desktop uses an `mcpServers` configuration. Add the following server entry to its MCP configuration file (the exact file location depends on the operating system and Claude Desktop version):

```json
{
  "mcpServers": {
    "local-filesystem-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/local-filesystem-mcp/dist/index.js"],
      "env": {
        "FILESYSTEM_ROOTS": "/absolute/path/to/allowed/directory",
        "FILESYSTEM_READ_ONLY": "true",
        "FILESYSTEM_ALLOW_DELETE": "false"
      }
    }
  }
}
```

Use the [Claude Desktop local MCP guide](https://support.anthropic.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) for current platform-specific configuration locations.

### Cursor

Cursor supports STDIO servers in its MCP configuration. A project-level `.cursor/mcp.json` can use this format:

```json
{
  "mcpServers": {
    "local-filesystem-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/local-filesystem-mcp/dist/index.js"],
      "env": {
        "FILESYSTEM_ROOTS": "/absolute/path/to/allowed/directory",
        "FILESYSTEM_READ_ONLY": "true",
        "FILESYSTEM_ALLOW_DELETE": "false"
      }
    }
  }
}
```

See [Cursor's MCP documentation](https://docs.cursor.com/context/model-context-protocol) for configuration scope and current client behavior.

### Visual Studio Code

VS Code uses a `servers` object in `.vscode/mcp.json` and explicitly identifies STDIO servers with `"type": "stdio"`:

```json
{
  "servers": {
    "local-filesystem-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/local-filesystem-mcp/dist/index.js"],
      "env": {
        "FILESYSTEM_ROOTS": "/absolute/path/to/allowed/directory",
        "FILESYSTEM_READ_ONLY": "true",
        "FILESYSTEM_ALLOW_DELETE": "false"
      }
    }
  }
}
```

See [VS Code's MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) for its current schema.

### Other compatible MCP clients

For clients that support launching local STDIO servers with an `mcpServers` configuration, use the Claude Desktop or Cursor entry as a starting point and follow that client's configuration format. The executable is `node`; the argument is the absolute path to `dist/index.js`.

These examples configure **STDIO**. The project also exposes an HTTP MCP endpoint at `/mcp` for remote clients. ChatGPT cannot connect to a local STDIO process; use the remote endpoint described below. The current HTTP handler does not enforce authentication, so do not expose it for use with a real filesystem until that is fixed.

### ChatGPT

The project listens for MCP requests locally at `http://127.0.0.1:3002/mcp`. LocalTunnel forwards port `3002` to a public HTTPS hostname. The current endpoints are:

| Use | Endpoint |
| --- | --- |
| Local MCP endpoint | `http://127.0.0.1:3002/mcp` |
| LocalTunnel public URL | `https://quiet-chicken-84.loca.lt` |
| ChatGPT or another remote MCP client | `https://quiet-chicken-84.loca.lt/mcp` |

Start both the development MCP server and LocalTunnel together with the project's public development script:

```sh
pnpm dev:public
```

The script runs `pnpm dev` and the configured LocalTunnel command together. Leave it running while the remote client is connected. LocalTunnel prints the public HTTPS URL it assigned. The public URL is made by forwarding the local port; append `/mcp` to that hostname to form the MCP endpoint. For example, `https://quiet-chicken-84.loca.lt` becomes `https://quiet-chicken-84.loca.lt/mcp`.

When a new tunnel starts with a different hostname, update the server connection in ChatGPT (or the corresponding remote MCP client settings): replace its existing endpoint with the new printed HTTPS hostname plus `/mcp`. For example, if LocalTunnel prints `https://new-host.loca.lt`, set the client endpoint to `https://new-host.loca.lt/mcp`.

**Security warning:** the LocalTunnel URL is publicly reachable. The project currently requires `MCP_AUTH_TOKEN`, but the HTTP handler does not call the token-checking helper, so requests to `/mcp` are not authenticated. Do not connect this public URL to a real filesystem or enable writes/deletes until server-side authentication is enforced and verified. Keep filesystem roots restricted and read-only during testing.

## Security

- **Allowed roots:** `FILESYSTEM_ROOTS` limits operations to configured directories. Roots must be absolute and resolvable on the host.
- **Allowed-root discovery:** `list_allowed_roots` returns the canonical absolute paths of configured roots. This exposes path names to connected clients; the current HTTP endpoint does not enforce authentication, so do not expose it through LocalTunnel with sensitive roots configured.
- **Current-directory lookup:** `get_current_directory` returns the process working directory only when path validation confirms it is within an allowed root.
- **Path validation:** inputs must be non-empty absolute paths. The validator canonicalizes existing paths and checks that the resulting path stays within an allowed root. For a new target, it canonicalizes the existing parent directory before checking the target.
- **Traversal and symlinks:** canonical path checks prevent `..` traversal and reject resolved paths outside the roots. Existing symlinks are resolved before the root check. Directory tree and size traversal skip symlinks according to their implementations. This does not remove all filesystem race conditions between validation and later operations.
- **Read-only mode:** `FILESYSTEM_READ_ONLY=true` blocks operations that use the write permission check. It defaults to `false`.
- **Delete permission:** deletion checks are denied by default and require `FILESYSTEM_ALLOW_DELETE=true`.
- **Audit logging:** `src/security/audit-log.ts` provides `logAuditEvent()`, which appends JSON Lines records containing a timestamp, action, path, and status to `~/.local/share/local-filesystem-mcp/audit.log`. It requests restrictive directory and file creation modes. It does not log file contents. Current wiring is inconsistent: several tools import a `withAudit` helper that is not exported by the module, so complete audit coverage is not established and those imports contribute to the current build errors.
- **Authentication:** no authentication is implemented. The server relies on the local client process and filesystem operating-system permissions.

This implementation provides useful access controls, but should not be treated as a complete security boundary. Run it as an unprivileged user, allow only directories the assistant needs, and review file changes and destructive requests.

## Testing

The package test script uses Node's test runner through `tsx`:

```sh
pnpm test
```

Current test files are:

- `tests/audit-log.test.ts`
- `tests/filesystem.test.ts`
- `tests/security.test.ts`
- `tests/tools.test.ts`

To run one test file directly:

```sh
pnpm exec tsx --test tests/security.test.ts
```

Replace the filename to run another file. The existing audit tests also refer to the missing `withAudit` export; test/build results should be checked after the API mismatch is resolved.

## Adding a new MCP tool

Tool registration follows the MCP SDK v2 `server.registerTool()` pattern. Add a module in `src/tools/`, validate paths and permission checks through the existing security helpers, then import and call its registration function from `src/tools/register-all-tools.ts`.

For example, a path-based tool module can use this minimal registration skeleton (replace the response body with the actual operation):

```ts
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { validatePath } from "../security/path-validator.js";
import { assertPermission } from "../security/permissions.js";
import { getErrorMessage } from "../utils/errors.js";

export function registerExampleTool(server: McpServer): void {
  server.registerTool(
    "example_tool",
    {
      description: "Example path-based tool",
      inputSchema: z.object({
        path: z.string().min(1).describe("Absolute path"),
      }),
    },
    async ({ path }) => {
      try {
        assertPermission("read");
        const safePath = await validatePath(path);

        return {
          content: [{ type: "text" as const, text: safePath }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: getErrorMessage(error) }],
          isError: true,
        };
      }
    },
  );
}
```

Import the registrar into `register-all-tools.ts` and call it from `registerAllTools(server)`. Follow the existing response shape and error handling. If the operation writes or deletes, use the appropriate permission check. Audit integration should be aligned with the current `audit-log.ts` API before claiming the new tool is audited.

## Troubleshooting

| Problem | Checks and next steps |
| --- | --- |
| Node.js version mismatch | Run `node --version`; install Node.js 20 or newer. |
| Dependency installation fails | Enable Corepack and activate pnpm 12.16.1, then retry `pnpm install`. Check registry/network access and the pnpm error output. |
| TypeScript build errors | Run `pnpm build` and inspect the first compiler errors. In the current checkout, tools import `withAudit` from `src/security/audit-log.ts`, but that module exports only `logAuditEvent`; some tests also expect the missing API. The configured `rootDir` is `src` while `include` also includes `tests`, which can produce root directory errors. These are existing source/configuration issues, not README setup steps. |
| Invalid filesystem root | Ensure every `FILESYSTEM_ROOTS` entry is absolute, exists, and is separated with the host platform's path delimiter. |
| Permission denied | Check that the requested canonical path is within an allowed root. For writes, check `FILESYSTEM_READ_ONLY`; for delete operations, check `FILESYSTEM_ALLOW_DELETE`. Also check operating-system permissions. |
| MCP Inspector cannot connect | Confirm the build succeeded, use the absolute `dist/index.js` path, run the Inspector command from a shell with Node available, and check stderr for startup errors. |
| Client does not launch the server | Confirm the client's JSON schema, absolute script path, `node` availability in its process environment, and configured environment variables. Restart or reload the client after editing its MCP configuration. |
| No HTTP connection is available | Only STDIO is implemented. The HTTP transport file is commented out. |

## Contributing

1. Fork the repository and create a focused branch.
2. Make a focused change and include tests for changed behavior.
3. Run the relevant tests and `pnpm build`; report any existing or new failures.
4. Open a pull request with a clear summary and verification notes.

Keep tool schemas, security checks, transport behavior, and documentation consistent with the implementation.

## License

This project is licensed under the [MIT License](LICENSE).
