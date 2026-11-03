
// import { createServer } from 'node:http';

// import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';

// import {
//     toNodeHandler,
//     localhostHostValidation,
//     localhostOriginValidation,
// } from '@modelcontextprotocol/node';

// import { registerAllTools } from '../tools/register-all-tools.js';

// const HOST = '127.0.0.1';
// const PORT = 3000;

// // Create an HTTP MCP handler.
// const handler = createMcpHandler(() => {
//     const server = new McpServer({
//         name: 'local-filesystem-mcp',
//         version: '1.0.0',
//     });

//     registerAllTools(server);

//     return server;
// });

// // Adapt the MCP handler for Node.js HTTP.
// const nodeHandler = toNodeHandler(handler);

// // Enable localhost security validation.
// const validateHost = localhostHostValidation();
// const validateOrigin = localhostOriginValidation();

// // Create the HTTP server.
// const httpServer = createServer((req, res) => {
//     if (!validateHost(req, res) || !validateOrigin(req, res)) {
//         return;
//     }

//     if (req.url?.split('?')[0] !== '/mcp') {
//         res.writeHead(404);
//         res.end('Not Found');
//         return;
//     }

//     void nodeHandler(req, res);
// });

// // Start the HTTP server.
// httpServer.listen(PORT, HOST, () => {
//     console.error('Local Filesystem MCP HTTP Server is running');
//     console.error(`Endpoint: http://${HOST}:${PORT}/mcp`);
// });

// // Handle graceful shutdown.
// async function shutdown(): Promise<void> {
//     httpServer.close();
//     await handler.close();
//     process.exit(0);
// }

// process.on('SIGINT', () => {
//     void shutdown();
// });

// process.on('SIGTERM', () => {
//     void shutdown();
// });
