import { describe, expect, it, vi } from "vitest";

import { runCommandTransaction } from "@/db/transaction";

describe("command transaction outcomes", () => {
  it("[AC-11] preserves a successful command result", async () => {
    const database = {
      transaction: vi.fn(async (command: () => Promise<string>) => command()),
    };

    await expect(
      runCommandTransaction<string>(database as never, async () => "saved"),
    ).resolves.toBe("saved");
  });

  it("[AC-12] marks a lost connection as an unknown outcome", async () => {
    const cause = Object.assign(new Error("connection reset"), {
      code: "ECONNRESET",
    });
    const database = {
      transaction: vi.fn(async () => {
        throw cause;
      }),
    };

    await expect(
      runCommandTransaction<string>(database as never, async () => "saved"),
    ).resolves.toEqual({ kind: "unknown_outcome", cause });
  });

  it("[AC-11] marks a domain or database error as retryable", async () => {
    const cause = new Error("serialization failure");
    const database = {
      transaction: vi.fn(async () => {
        throw cause;
      }),
    };

    await expect(
      runCommandTransaction<string>(database as never, async () => "saved"),
    ).resolves.toEqual({ kind: "retryable", cause });
  });
});
