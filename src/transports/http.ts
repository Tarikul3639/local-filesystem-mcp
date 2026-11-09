import { createServer } from "node:http";

import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";

import { env } from "../config/env.js";
import { authenticateRequest } from "../security/authentication.js";

export function startHttpTransport(server: McpServer): void {
  const handler = createMcpHandler(() => server);
  const nodeHandler = toNodeHandler(handler);

  const httpServer = createServer(async (req, res) => {
    if (req.url?.split("?")[0] !== "/mcp") {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    // TODO: We need web page for authentication, so now just check for the token in the header and if it matches, allow the request to proceed. If not, return 401 Unauthorized.
    // const authorized = authenticateRequest(req.headers.authorization);

    // if (!authorized) {
    //     res.writeHead(401, {
    //         "Content-Type": "application/json",
    //     });

    //     res.end(
    //         JSON.stringify({
    //             error: "Unauthorized",
    //         }),
    //     );

    //     return;
    // }

    try {
      await nodeHandler(
        req as unknown as Parameters<typeof nodeHandler>[0],
        res,
      );
    } catch {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    }
  });

  httpServer.listen(env.HTTP_PORT, env.HTTP_HOST, () => {
    console.error("Local Filesystem MCP HTTP Server started");
    console.error(`Host: ${env.HTTP_HOST}`);
    console.error(`Port: ${env.HTTP_PORT}`);
    console.error(`MCP Endpoint: http://${env.HTTP_HOST}:${env.HTTP_PORT}/mcp`);
  });

  async function shutdown(): Promise<void> {
    httpServer.close();
    await handler.close();
  }

  process.once("SIGINT", () => {
    void shutdown();
  });

  process.once("SIGTERM", () => {
    void shutdown();
  });
}
