import { roundToNearestRupee } from "@/db/contracts";

export type Measurement = {
  enteredValue: string;
  enteredUnit: "mm" | "cm" | "in" | "ft";
  normalizedMillimetres: string;
};

export type PriceCalculation = {
  calculationComponents: readonly {
    rule: string;
    inputs: Readonly<Record<string, string | boolean>>;
    amountPaisa: bigint;
  }[];
  subtotal: bigint;
  adjustment: bigint;
  taxLabel: string;
  tax: bigint;
  roundedTotal: bigint;
};

export interface PriceCalculator {
  calculate(input: {
    serviceDefinition: unknown;
    priceRuleDefinition: unknown;
    configuration: unknown;
    quantity: bigint;
    measurements: readonly Measurement[];
    shopSettings: unknown;
  }): PriceCalculation;
}

export function createTestStandardPriceCalculator(
  ratePaisa: bigint,
): PriceCalculator {
  if (ratePaisa < 0n) {
    throw new Error("The test rate cannot be negative");
  }

  return {
    calculate({ quantity }) {
      if (quantity <= 0n) {
        throw new Error("Quantity must be positive");
      }

      const subtotal = ratePaisa * quantity;
      return {
        calculationComponents: [
          {
            rule: "test_standard_v1",
            inputs: { quantity: quantity.toString(10) },
            amountPaisa: subtotal,
          },
        ],
        subtotal,
        adjustment: 0n,
        taxLabel: "No tax",
        tax: 0n,
        roundedTotal: roundToNearestRupee(subtotal),
      };
    },
  };
}

const unitMicromillimetres = {
  mm: 1_000_000n,
  cm: 10_000_000n,
  in: 25_400_000n,
  ft: 304_800_000n,
} as const;

export function normalizeMeasurement(
  enteredValue: string,
  enteredUnit: keyof typeof unitMicromillimetres,
): Measurement {
  if (!/^\d+(?:\.\d{1,6})?$/.test(enteredValue)) {
    throw new Error("Measurement must have at most six decimal places");
  }

  const [whole, fraction = ""] = enteredValue.split(".");
  const scaledInput =
    BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));

  if (scaledInput <= 0n) {
    throw new Error("Measurement must be positive");
  }

  const normalizedScaled =
    (scaledInput * unitMicromillimetres[enteredUnit]) / 1_000_000n;
  const normalizedWhole = normalizedScaled / 1_000_000n;
  const normalizedFraction = (normalizedScaled % 1_000_000n)
    .toString(10)
    .padStart(6, "0")
    .replace(/0+$/, "");

  return {
    enteredValue,
    enteredUnit,
    normalizedMillimetres: normalizedFraction
      ? `${normalizedWhole}.${normalizedFraction}`
      : normalizedWhole.toString(10),
  };
}
