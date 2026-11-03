import { resolve } from "node:path";
import { env } from "./env.js";

export const ALLOWED_ROOTS = env.FILESYSTEM_ROOTS.map((path) => resolve(path));
