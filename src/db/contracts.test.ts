import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  moneyStringSchema,
  positiveNumericStringSchema,
  requestFingerprint,
  roundToNearestRupee,
} from "@/db/contracts";

describe("numeric contracts", () => {
  it("keeps money above the safe integer boundary exact", () => {
    const amount = 9_007_199_254_740_993n;
    expect(canonicalJson({ amount })).toBe('{"amount":"9007199254740993"}');
    expect(moneyStringSchema.parse(amount.toString(10))).toBe(
      "9007199254740993",
    );
  });

  it("creates stable fingerprints independent of object key order", () => {
    expect(requestFingerprint({ amount: 125n, name: "job" })).toBe(
      requestFingerprint({ name: "job", amount: 125n }),
    );
  });

  it("rounds positive half rupees up once", () => {
    expect(roundToNearestRupee(149n)).toBe(100n);
    expect(roundToNearestRupee(150n)).toBe(200n);
    expect(roundToNearestRupee(251n)).toBe(300n);
    expect(() => roundToNearestRupee(-1n)).toThrow();
  });

  it("[AC-2] rejects fractional money and preserves nested bigint values", () => {
    expect(() => moneyStringSchema.parse("10.00")).toThrow();
    expect(canonicalJson({ lines: [{ amount: 12n }], total: 15n })).toBe(
      '{"lines":[{"amount":"12"}],"total":"15"}',
    );
  });

  it("[AC-8] rejects zero and overly precise numeric values", () => {
    expect(() => positiveNumericStringSchema.parse("0")).toThrow();
    expect(() => positiveNumericStringSchema.parse("1.1234567")).toThrow();
    expect(positiveNumericStringSchema.parse("0.000001")).toBe("0.000001");
  });
});
