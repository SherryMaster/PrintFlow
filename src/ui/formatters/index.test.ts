import { describe, expect, it } from "vitest";

import { formatLocalDate, formatMoney, formatShopInstant } from ".";

describe("shared customer formatting", () => {
  it("[V5] keeps integer paisa exact, including very large values", () => {
    expect(formatMoney(0n)).toBe("PKR 0.00");
    expect(formatMoney(123400n)).toBe("PKR 1,234.00");
    expect(formatMoney("125")).toBe("PKR 1.25");
    expect(formatMoney(null)).toBe("Quote required");
    expect(formatMoney("900719925474099301")).toBe(
      "PKR 9,007,199,254,740,993.01",
    );
    expect(() => formatMoney("1.5")).toThrow();
  });

  it("[V5] keeps a local date separate from a UTC instant", () => {
    expect(formatLocalDate("2026-09-23")).toContain("23");
    expect(formatShopInstant("2026-09-22T20:00:00Z", "Asia/Karachi")).toContain(
      "23",
    );
    expect(() => formatLocalDate("2026-02-30")).toThrow();
    expect(() =>
      formatShopInstant("2026-09-23T12:00:00", "Asia/Karachi"),
    ).toThrow();
  });

  it("[V5] rejects an invalid instant", () => {
    expect(() => formatShopInstant("not-a-dateZ", "Asia/Karachi")).toThrow(
      "Invalid UTC instant",
    );
  });
});
