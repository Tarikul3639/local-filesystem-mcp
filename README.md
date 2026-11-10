# Local Filesystem MCP

A local TypeScript [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that lets compatible AI assistants work with files and directories, inspect the local system, capture screenshots, run approved commands, and automate a headless Chromium browser.

Filesystem operations are restricted to configured allowed roots. The server includes permission checks and audit logging. It intentionally does **not** expose permanent file or directory deletion tools.

## Features

The server registers **41 MCP tools** across five areas.

### File operations

| Tool                   | Inputs                       | Description                                                          |
| ---------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `read_file`            | `path`                       | Read a UTF-8 text file.                                              |
| `read_multiple_files`  | `paths`                      | Read 1–20 text files in one call.                                    |
| `write_file`           | `path`, `content`            | Create a file or replace its contents.                               |
| `append_file`          | `path`, `content`            | Append text to a file.                                               |
| `edit_file`            | `path`, `oldText`, `newText` | Replace a matching text occurrence.                                  |
| `copy_file`            | `source`, `destination`      | Copy a file.                                                         |
| `move_file`            | `source`, `destination`      | Move or rename a file.                                               |
| `search_files`         | `path`, `query`              | Search names recursively; does not search file contents.             |
| `list_files`           | `path`                       | List immediate directory entries.                                    |
| `get_file_info`        | `path`                       | Return file or directory metadata.                                   |
| `get_file_hash`        | `path`                       | Calculate a file's SHA-256 hash.                                     |
| `get_file_permissions` | `path`                       | Inspect permission bits.                                             |
| `set_file_permissions` | `path`, `mode`               | Change permission bits using an integer mode.                        |
| `trust_file`           | `path`                       | Add a regular file to the local trust store.                         |
| `untrust_file`         | `path`                       | Remove a file from the local trust store.                            |
| `delete_file`          | `path`                       | Move a file into the `.trash/` folder; never permanently deletes it. |
| `restore_from_trash`   | `path`                       | Restore a trashed file or directory to its original path.            |

### Directory operations

| Tool                 | Inputs                             | Description                                              |
| -------------------- | ---------------------------------- | -------------------------------------------------------- |
| `create_directory`   | `path`                             | Create a directory.                                      |
| `get_directory_tree` | `path`, optional `maxDepth`        | Return a recursive directory tree.                       |
| `get_directory_size` | `path`                             | Calculate the total directory size.                      |
| `move_directory`     | `source`, `destination`            | Move a directory and update matching trust-store paths.  |
| `watch_directory`    | `path`, optional `durationSeconds` | Watch for filesystem changes for 1–60 seconds.           |
| `trust_directory`    | `path`                             | Add a directory to the local trust store.                |
| `untrust_directory`  | `path`                             | Remove a directory from the local trust store.           |
| `delete_directory`   | `path`                             | Move a directory and all its contents into `.trash/`.    |
| `restore_directory`  | `path`                             | Restore a directory and all its contents from `.trash/`. |

### System tools

| Tool                     | Inputs                                                      | Description                                                                    |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `get_current_directory`  | None                                                        | Return the server process working directory when it is within an allowed root. |
| `list_allowed_roots`     | None                                                        | List configured filesystem roots.                                              |
| `get_disk_usage`         | `path`                                                      | Report total, used, free, and available disk space.                            |
| `run_command`            | `command`, optional `args`, `workingDirectory`, `confirmed` | Run commands accepted by the server's command allowlist.                       |
| `take_screenshot`        | optional `saveTo`                                           | Capture the full desktop.                                                      |
| `take_screenshot_region` | optional `saveTo`                                           | Interactively capture a selected screen region.                                |
| `take_window_screenshot` | optional `saveTo`                                           | Capture the active application window.                                         |

Screenshot files can optionally be saved as PNG files inside an allowed root. Without `saveTo`, the image is returned to the MCP client and the temporary capture is cleaned up.

### Browser automation

Browser tools use Playwright and a headless Chromium browser. The current implementation keeps one browser session and one active page in memory.

| Tool                 | Inputs                               | Description                                      |
| -------------------- | ------------------------------------ | ------------------------------------------------ |
| `browser_navigate`   | `url`, optional `waitUntil`          | Navigate to an HTTP or HTTPS URL.                |
| `browser_click`      | `selector`                           | Click the first element matching a CSS selector. |
| `browser_type`       | `selector`, `text`                   | Fill the first matching form field.              |
| `browser_get_text`   | optional `selector`, `maxCharacters` | Extract page text.                               |
| `browser_get_links`  | optional `limit`                     | List page links and their absolute URLs.         |
| `browser_screenshot` | optional `fullPage`                  | Return a PNG screenshot of the browser page.     |
| `browser_go_back`    | None                                 | Navigate back in browser history.                |
| `browser_close`      | None                                 | Close the current browser session.               |

This is a basic browser automation layer, not a full browser-control framework. Multiple tabs, persistent login profiles, downloads/uploads, keyboard and mouse APIs, semantic locators, and network/console inspection are not currently implemented. URL validation currently checks the URL format, HTTP(S) protocol, and embedded credentials; it does **not** provide complete SSRF protection. Only navigate to websites you trust, and do not use this browser against private/internal network services.

## Technology stack

- Node.js 20 or newer
- TypeScript
- pnpm 12.16.1
- MCP SDK v2: `@modelcontextprotocol/server`
- `@modelcontextprotocol/node` for the Node HTTP handler
- Zod v4 for tool schemas and environment validation
- Playwright with Chromium for browser automation
- dotenv for environment configuration
- Prettier for formatting

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
│   │   ├── command-allowlist.ts
│   │   ├── command-runner.ts
│   │   ├── command-validator.ts
│   │   ├── path-validator.ts
│   │   ├── permissions.ts
│   │   ├── register-trust-action.ts
│   │   └── trust-store.ts
│   ├── tools/
│   │   ├── browser/
│   │   │   ├── browser-context.ts
│   │   │   ├── browser-navigate.tool.ts
│   │   │   ├── browser-click.tool.ts
│   │   │   ├── browser-type.tool.ts
│   │   │   ├── browser-screenshot.tool.ts
│   │   │   ├── browser-get-text.tool.ts
│   │   │   ├── browser-get-links.tool.ts
│   │   │   ├── browser-go-back.tool.ts
│   │   │   └── browser-close.tool.ts
│   │   ├── directory-operations/
│   │   │   ├── delete-directory.tool.ts
│   │   │   └── restore-directory.tool.ts
│   │   ├── file-operations/
│   │   │   ├── delete-file.tool.ts
│   │   │   └── restore-from-trash.tool.ts
│   │   ├── system/
│   │   │   └── screenshot.tool.ts
│   │   └── register-all-tools.ts
│   ├── transports/
│   │   ├── http.ts
│   │   └── stdio.ts
│   ├── utils/
│   │   └── errors.ts
│   └── index.ts
├── tests/
├── logs/
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

The trust store is stored under `logs/trust-store.json`; audit events are written under `logs/`. Trash is stored in a `.trash/` directory inside the corresponding allowed root. Original relative paths are preserved, and restore operations refuse to overwrite an existing destination. Directory moves also update matching trust-store paths. The exact source files for each tool are grouped by operation type.

## Prerequisites

- Node.js 20+
- pnpm 12.16.1
- Git
- A supported desktop screenshot utility if you want to use desktop screenshot tools:
  - `gnome-screenshot`, `scrot`, `flameshot`, or ImageMagick's `import`
- Chromium installed through Playwright for browser tools

## Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url> local-filesystem-mcp
cd local-filesystem-mcp
corepack enable
corepack prepare pnpm@12.16.1 --activate
pnpm install
```

Install the Playwright Chromium browser:

```bash
pnpm exec playwright install chromium
```

On Linux, if required operating-system libraries are missing, install them with:

```bash
pnpm exec playwright install --with-deps chromium
```

Playwright is installed as a project dependency in `node_modules`. Chromium is downloaded to Playwright's browser cache for the current operating-system user (commonly `~/.cache/ms-playwright` on Linux).

## Environment configuration

Create a `.env` file in the project root. Configure the variables supported by `src/config/env.ts`:

| Variable               | Default                       | Description                                                                                                                                                                                                     |
| ---------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FILESYSTEM_ROOTS`     | Current user's home directory | One or more existing absolute paths the server is allowed to access. Separate multiple roots with the platform path delimiter (usually `: ` on POSIX without the space, and `; ` on Windows without the space). |
| `FILESYSTEM_READ_ONLY` | `false`                       | Set to `true` to block filesystem write, append, edit, copy, move, and directory-creation actions.                                                                                                              |
| `HTTP_HOST`            | `127.0.0.1`                   | HTTP bind host. The current schema accepts only `127.0.0.1`.                                                                                                                                                    |
| `HTTP_PORT`            | `3002`                        | HTTP server port.                                                                                                                                                                                               |
| `MCP_AUTH_TOKEN`       | Required                      | A non-empty token required by environment validation.                                                                                                                                                           |

Example for Linux:

```dotenv
FILESYSTEM_ROOTS=/home/your-user/Documents:/home/your-user/Projects
FILESYSTEM_READ_ONLY=false
HTTP_HOST=127.0.0.1
HTTP_PORT=3002
MCP_AUTH_TOKEN=replace-with-a-long-random-secret
```

Use real paths that exist on your machine. Do not commit `.env` or publish your token. The current environment schema does not define `FILESYSTEM_ALLOW_DELETE`; permanent deletion tools are not registered.

## Running the server

Available scripts:

| Command       | Purpose                                     |
| ------------- | ------------------------------------------- |
| `pnpm dev`    | Run the TypeScript server with `tsx watch`. |
| `pnpm build`  | Compile TypeScript into `dist/`.            |
| `pnpm start`  | Run the compiled server.                    |
| `pnpm test`   | Run the Node.js test suites.                |
| `pnpm format` | Format project files with Prettier.         |

Build and start:

```bash
pnpm build
pnpm start
```

Or run in development:

```bash
pnpm dev
```

The entry point starts both STDIO and HTTP transports. STDIO is intended for MCP clients that launch the server process. The HTTP MCP endpoint is:

```text
http://127.0.0.1:<HTTP_PORT>/mcp
```

### HTTP authentication status

An authentication helper using a Bearer token exists, but the authorization check in `src/transports/http.ts` is currently commented out. The HTTP endpoint therefore does **not** enforce `MCP_AUTH_TOKEN` at request time. It binds to loopback (`127.0.0.1`) by default; do not expose or forward this endpoint to an untrusted network until request authentication is enabled and tested. The token is still required by current environment validation.

## Connecting an MCP client

The exact configuration format depends on the MCP client. For a local STDIO connection, configure the client to launch the built entry point with Node.js and pass the required environment variables.

Generic example:

```json
{
  "mcpServers": {
    "local-filesystem-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/local-filesystem-mcp/dist/index.js"],
      "env": {
        "FILESYSTEM_ROOTS": "/absolute/path/to/allowed/directory",
        "FILESYSTEM_READ_ONLY": "true",
        "HTTP_HOST": "127.0.0.1",
        "HTTP_PORT": "3002",
        "MCP_AUTH_TOKEN": "replace-with-a-long-random-secret"
      }
    }
  }
}
```

Use an absolute path to `dist/index.js`, build before connecting, and ensure the configured roots exist. Follow the documentation for your MCP client for its current configuration file and schema.

## Security

- **Allowed roots:** Filesystem paths are validated against the configured roots. Use the narrowest roots that support your workflow.
- **Read-only mode:** Set `FILESYSTEM_READ_ONLY=true` when you only need to inspect files.
- **Trash instead of permanent deletion:** `delete_file` and `delete_directory` move items into `.trash/` under the matching allowed root. They preserve the original relative path and refuse to overwrite an existing Trash item.\n- **Restore support:** `restore_from_trash` restores a trashed file or directory automatically; `restore_directory` restores directories specifically. Restore refuses to overwrite an existing original path. For nested items, restore parent directories first.
- **Overwrites and moves:** `write_file` can replace an existing file; move operations change paths; permission tools change access bits. Review these actions before invoking them.
- **Command execution:** `run_command` accepts only commands and arguments permitted by the project's allowlist. Shell interpretation is disabled.
- **Audit logging:** Tool operations are recorded in the local logs directory.
- **Trust store:** Trusted file and directory entries are stored locally. Trust registration is not a substitute for operating-system permissions or content validation.
- **Browser security:** Browser URL checks are basic and do not fully prevent server-side request forgery (SSRF). Do not browse untrusted URLs or internal/private network targets.
- **HTTP security:** HTTP Bearer authentication is not currently enforced; keep the endpoint bound to loopback and do not expose it to a network.

## Testing and formatting

Run:

```bash
pnpm test
pnpm build
pnpm format
```

To format without changing files, you can run:

```bash
pnpm exec prettier --check .
```

## Troubleshooting

| Problem                                  | What to check                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm` is unavailable                    | Enable Corepack and activate the pnpm version declared in `package.json`.                              |
| `playwright: command not found`          | Run `pnpm install` in this project directory and confirm `playwright` appears in `dependencies`.       |
| Chromium executable is missing           | Run `pnpm exec playwright install chromium`.                                                           |
| Chromium reports missing Linux libraries | Run `pnpm exec playwright install --with-deps chromium` or install the required OS packages.           |
| Screenshot capture fails                 | Install one of the supported screenshot utilities and ensure a graphical desktop session is available. |
| Filesystem path is rejected              | Confirm the path is absolute and falls within one of `FILESYSTEM_ROOTS`.                               |
| Write operation is denied                | Check `FILESYSTEM_READ_ONLY` and operating-system permissions.                                         |
| HTTP endpoint does not respond           | Confirm `HTTP_HOST`, `HTTP_PORT`, server startup logs, and that the request path is `/mcp`.            |

## Contributing

1. Create a focused branch for your change.
2. Keep tool schemas, permission checks, audit events, and documentation consistent.
3. Add or update tests for behavior changes.
4. Run `pnpm test` and `pnpm build`.
5. Document security implications and known limitations.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Filesystem access policies

The server applies path restrictions centrally through `validatePath`, so the rules cover file, directory, and browser screenshot save operations.

| Variable                      | Default                       | Purpose                                                                                                              |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `FILESYSTEM_ROOTS`            | Current user's home directory | One or more allowed base directories.                                                                                |
| `FILESYSTEM_DENY_ROOT_ACCESS` | `true`                        | Blocks direct access to each configured root itself while allowing permitted child paths.                            |
| `FILESYSTEM_BLOCKED_PATHS`    | Empty                         | Explicit absolute file or directory paths to deny, including all descendants of a blocked directory.                 |
| `FILESYSTEM_ALLOW_ENV_FILES`  | `false`                       | Allows or blocks dotenv files such as `.env`, `.env.local`, and `.env.production`. `.env.example` is always allowed. |
| `FILESYSTEM_READ_ONLY`        | `false`                       | Blocks filesystem write operations when enabled.                                                                     |

On Linux/macOS, separate multiple paths with `:`; on Windows, use `; ` (without the space). For example:

```dotenv
FILESYSTEM_ROOTS=/home/your-user/Desktop:/home/your-user/Downloads
FILESYSTEM_DENY_ROOT_ACCESS=true
FILESYSTEM_BLOCKED_PATHS=/home/your-user/Desktop/Private:/home/your-user/Documents/Confidential
FILESYSTEM_ALLOW_ENV_FILES=false
FILESYSTEM_READ_ONLY=false
```

A blocked directory also blocks every path below it. Configure exact absolute paths that exist on disk. The configured roots should be broad enough to contain the folders you need, but as narrow as practical. Denying a root blocks listing or reading that root directly; it does not automatically block its children.

### Browser screenshots

The `browser_screenshot` tool accepts `fullPage` and an optional `saveTo` absolute path. The destination must end in `.png`, be inside an allowed root, and must not already exist. Example:

```json
{
  "fullPage": true,
  "saveTo": "/home/your-user/Desktop/project/docs/screenshots/home.png"
}
```

The screenshot save destination is checked against the same root, blocked-path, and dotenv-file policies as other filesystem operations.
