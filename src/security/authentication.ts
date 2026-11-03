import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function authenticateRequest(
    authorization: string | undefined,
): boolean {
    const expectedToken = Buffer.from(env.MCP_AUTH_TOKEN, "utf-8");

    const suppliedToken = Buffer.from(
        authorization?.startsWith("Bearer ") ? authorization.slice(7) : "",
        "utf-8",
    );

    return (
        suppliedToken.length === expectedToken.length &&
        timingSafeEqual(suppliedToken, expectedToken)
    );
}
