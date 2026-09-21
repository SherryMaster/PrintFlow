import { describe, expect, it } from "vitest";

import {
  createOrderUploadSession,
  createUploadIntent,
} from "@/storage/commands";

const shopId = "37e69597-d813-4e6a-a8f4-c3edc8f41870";
const orderId = "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd";
const jobId = "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4";

describe("private upload boundaries", () => {
  it("[AC-11] rejects zero and oversized upload reservations before database access", async () => {
    const authority = { kind: "draft" as const, capability: "a".repeat(43) };

    await expect(
      createUploadIntent({
        shopId,
        uploadSessionId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
        authority,
        filename: "artwork.pdf",
        mediaType: "application/pdf",
        requestedBytes: 0n,
      }),
    ).rejects.toThrow("validation_failed");
    await expect(
      createUploadIntent({
        shopId,
        uploadSessionId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
        authority,
        filename: "artwork.pdf",
        mediaType: "application/pdf",
        requestedBytes: 250n * 1024n * 1024n + 1n,
      }),
    ).rejects.toThrow("validation_failed");
  });

  it("[AC-10] does not let a guest create a proof upload session", async () => {
    const authority = {
      kind: "guest" as const,
      shopId,
      orderId,
      grantId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
      scopes: ["artwork:upload"] as const,
    };

    await expect(
      createOrderUploadSession({
        shopId,
        orderId,
        jobId,
        purpose: "proof",
        authority,
      }),
    ).rejects.toThrow("not_found");
  });
});
