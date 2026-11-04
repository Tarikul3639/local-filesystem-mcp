
import type { McpServer } from '@modelcontextprotocol/server';

// Core tools
import { registerListFilesTool } from './list-files.tool.js';
import { registerListAllowedRootsTool } from './list-allowed-roots.tool.js';
import { registerGetCurrentDirectoryTool } from './get-current-directory.tool.js';
import { registerReadFileTool } from './read-file.tool.js';
import { registerWriteFileTool } from './write-file.tool.js';
import { registerDeleteFileTool } from './delete-file.tool.js';
import { registerCopyFileTool } from './copy-file.tool.js';
import { registerMoveFileTool } from './move-file.tool.js';
import { registerSearchFilesTool } from './search-files.tool.js';
import { registerGetFileInfoTool } from './get-file-info.tool.js';
import { registerDirectoryTool } from './directory.tool.js';

// Advanced tools
import { registerAppendFileTool } from './append-file.tool.js';
import { registerEditFileTool } from './edit-file.tool.js';
import { registerReadMultipleFilesTool } from './read-multiple-files.tool.js';
import { registerGetDirectoryTreeTool } from './get-directory-tree.tool.js';
import { registerGetDirectorySizeTool } from './get-directory-size.tool.js';
import { registerGetFileHashTool } from './get-file-hash.tool.js';
import { registerGetFilePermissionsTool } from './get-file-permissions.tool.js';
import { registerSetFilePermissionsTool } from './set-file-permissions.tool.js';
import { registerGetDiskUsageTool } from './get-disk-usage.tool.js';
import { registerWatchDirectoryTool } from './watch-directory.tool.js';
import { registerRunCommandTool } from './run-command.tool.js';

export function registerAllTools(server: McpServer): void {
  // Register Core Tools
  registerListAllowedRootsTool(server);
  registerGetCurrentDirectoryTool(server);
  registerListFilesTool(server);
  registerReadFileTool(server);
  registerWriteFileTool(server);
  registerDeleteFileTool(server);
  registerCopyFileTool(server);
  registerMoveFileTool(server);
  registerSearchFilesTool(server);
  registerGetFileInfoTool(server);
  registerDirectoryTool(server);

  // Register Advanced Tools
  registerAppendFileTool(server);
  registerEditFileTool(server);
  registerReadMultipleFilesTool(server);
  registerGetDirectoryTreeTool(server);
  registerGetDirectorySizeTool(server);
  registerGetFileHashTool(server);
  registerGetFilePermissionsTool(server);
  registerSetFilePermissionsTool(server);
  registerGetDiskUsageTool(server);
  registerWatchDirectoryTool(server);
  registerRunCommandTool(server);
}
