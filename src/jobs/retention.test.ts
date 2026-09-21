import { describe, expect, it } from "vitest";

import { fileBytesCutoff, privateDetailsCutoff } from "@/jobs/retention";

describe("retention cutoffs", () => {
  it("uses 90 exact days for terminal file bytes", () => {
    expect(
      fileBytesCutoff(new Date("2026-09-19T12:00:00.000Z")).toISOString(),
    ).toBe("2026-06-21T12:00:00.000Z");
  });

  it("uses 24 calendar months for private details", () => {
    expect(
      privateDetailsCutoff(new Date("2026-09-19T12:00:00.000Z")).toISOString(),
    ).toBe("2024-09-19T12:00:00.000Z");
  });
});
