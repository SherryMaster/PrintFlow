import { describe, expect, it } from "vitest";

import type { DomainErrorCode } from "@/db/contracts";
import { domainErrorMessage } from "./domain-errors";

describe("domain error feedback", () => {
  it("[V6] gives clear guidance for every domain error", () => {
    const errorCodes: DomainErrorCode[] = [
      "not_found",
      "forbidden",
      "stale_version",
      "invalid_transition",
      "conflict",
      "validation_failed",
      "expired",
      "superseded",
      "quarantined",
      "erased",
      "stale_lease",
    ];

    expect(errorCodes.map(domainErrorMessage)).toEqual([
      "We could not find that item. Check the link and try again.",
      "You do not have access to this action.",
      "This changed while you were working. Refresh and review the latest details.",
      "This step is not available in the current state.",
      "This request conflicts with a recent change. Review the details and try again.",
      "Some details need attention. Check the highlighted fields.",
      "This link or action has expired. Request a new one.",
      "A newer version is available. Review it before continuing.",
      "This file is being checked and cannot be used yet.",
      "This item is no longer available.",
      "The action timed out. Refresh before trying again.",
    ]);
  });
});
