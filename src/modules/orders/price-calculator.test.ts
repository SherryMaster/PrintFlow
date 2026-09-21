import { describe, expect, it } from "vitest";

import {
  createTestStandardPriceCalculator,
  normalizeMeasurement,
} from "@/modules/orders/price-calculator";

describe("price calculator contract", () => {
  it("calculates a deterministic test only standard price", () => {
    const calculator = createTestStandardPriceCalculator(155n);
    const result = calculator.calculate({
      serviceDefinition: {},
      priceRuleDefinition: {},
      configuration: {},
      quantity: 3n,
      measurements: [],
      shopSettings: {},
    });

    expect(result.subtotal).toBe(465n);
    expect(result.roundedTotal).toBe(500n);
  });

  it("uses exact measurement conversion constants", () => {
    expect(normalizeMeasurement("1", "cm").normalizedMillimetres).toBe("10");
    expect(normalizeMeasurement("1", "in").normalizedMillimetres).toBe("25.4");
    expect(normalizeMeasurement("1", "ft").normalizedMillimetres).toBe("304.8");
  });

  it("[AC-8] retains entered measurement values while normalizing fractions", () => {
    expect(normalizeMeasurement("2.500000", "cm")).toEqual({
      enteredValue: "2.500000",
      enteredUnit: "cm",
      normalizedMillimetres: "25",
    });
  });

  it("[AC-2] rejects nonpositive quantities and rates", () => {
    expect(() => createTestStandardPriceCalculator(-1n)).toThrow();
    const calculator = createTestStandardPriceCalculator(100n);

    expect(() =>
      calculator.calculate({
        serviceDefinition: {},
        priceRuleDefinition: {},
        configuration: {},
        quantity: 0n,
        measurements: [],
        shopSettings: {},
      }),
    ).toThrow();
    expect(() => normalizeMeasurement("0", "mm")).toThrow();
    expect(() => normalizeMeasurement("1.1234567", "mm")).toThrow();
  });
});
