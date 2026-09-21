import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/db/schema";

export type InfrastructureFailure = {
  kind: "retryable" | "unknown_outcome";
  cause: unknown;
};

const unknownOutcomeCodes = new Set([
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
  "ECONNRESET",
  "EPIPE",
]);

export async function runCommandTransaction<T>(
  db: PostgresJsDatabase<typeof schema>,
  command: Parameters<typeof db.transaction<T>>[0],
): Promise<T | InfrastructureFailure> {
  try {
    return await db.transaction(command);
  } catch (cause) {
    const code =
      typeof cause === "object" && cause && "code" in cause
        ? String(cause.code)
        : undefined;

    return {
      kind:
        code && unknownOutcomeCodes.has(code) ? "unknown_outcome" : "retryable",
      cause,
    };
  }
}
