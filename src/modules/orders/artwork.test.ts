import { describe, expect, it } from "vitest";

import { createProof, recordArtworkReview } from "@/modules/orders/artwork";

const shopId = "37e69597-d813-4e6a-a8f4-c3edc8f41870";
const orderId = "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd";
const jobId = "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4";
const admin = {
  kind: "admin" as const,
  shopId,
  membershipId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
};
const guest = {
  kind: "guest" as const,
  shopId,
  orderId,
  grantId: "d6f3d8a7-3b54-4f70-a5d3-22e0d1c8f777",
  scopes: ["order:read"] as const,
};

describe("artwork command boundaries", () => {
  it("[AC-5] requires at least one artwork source for a proof", async () => {
    await expect(
      createProof({
        shopId,
        orderId,
        jobId,
        jobRevisionId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
        storedObjectId: "d6f3d8a7-3b54-4f70-a5d3-22e0d1c8f777",
        artworkVersionIds: [],
        creatorSnapshotId: "9d4c2a1b-1f6f-4f73-9f7a-0b0d5e4c2e61",
        authority: admin,
        expectedOrderVersion: 1,
        expectedJobVersion: 1,
      }),
    ).rejects.toThrow("validation_failed");
  });

  it("[AC-10] refuses guest authority at the administrator artwork review boundary", async () => {
    await expect(
      recordArtworkReview({
        shopId,
        orderId,
        jobId,
        artworkVersionId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
        decision: "accepted",
        reason: "Looks good",
        actorSnapshotId: "9d4c2a1b-1f6f-4f73-9f7a-0b0d5e4c2e61",
        authority: guest,
        expectedOrderVersion: 1,
        expectedJobVersion: 1,
      }),
    ).rejects.toThrow("not_found");
  });
});
