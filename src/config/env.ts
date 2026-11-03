import "dotenv/config";

import { homedir } from "node:os";
import { delimiter, isAbsolute } from "node:path";
import * as z from "zod/v4";

const envSchema = z.object({
    FILESYSTEM_ROOTS: z
        .string()
        .default(homedir())
        .transform((value) =>
            value
                .split(delimiter)
                .map((path) => path.trim())
                .filter(Boolean),
        )
        .pipe(
            z
                .array(z.string().min(1, "Filesystem root cannot be empty"))
                .min(1, "At least one filesystem root is required"),
        )
        .refine(
            (paths) => paths.every(isAbsolute),
            "All filesystem roots must be absolute paths",
        ),

    FILESYSTEM_READ_ONLY: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),

    FILESYSTEM_ALLOW_DELETE: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error("Invalid environment configuration:");

    for (const issue of result.error.issues) {
        console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    }

    throw new Error("Environment validation failed");
}

export const env = result.data;

export type Env = typeof env;
