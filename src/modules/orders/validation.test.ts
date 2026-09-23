import { describe, expect, it } from "vitest";

import {
  calculationSnapshotSchema,
  contactInputSchema,
  measurementSchema,
  normalizeEmail,
  normalizePakistanPhone,
  priceRuleSchema,
  serviceDefinitionSchema,
  shopSettingsSchema,
  shopSettingsReadSchema,
} from "@/modules/orders/validation";
import { pilotShopSettings } from "@/ui/theme/branding";

const validSettings = {
  schema_version: "shop_settings.v1" as const,
  quote_validity_days: 7,
  rounding_rule: "nearest_rupee_half_up" as const,
};

describe("order data contracts", () => {
  it("[V2] accepts valid branded settings and rejects invalid settings", () => {
    const settings = pilotShopSettings(7);

    expect(shopSettingsReadSchema.parse(settings)).toEqual(settings);
    expect(() =>
      shopSettingsSchema.parse({ ...settings, quote_validity_days: 0 }),
    ).toThrow();
    expect(() =>
      shopSettingsSchema.parse({
        ...settings,
        branding: {
          ...settings.branding,
          palette: { ...settings.branding.palette, primary: "red" },
        },
      }),
    ).toThrow();
    expect(() =>
      shopSettingsSchema.parse({ ...settings, unexpected: true }),
    ).toThrow();
  });

  it("[AC-15] accepts the pilot shop settings and rejects extra fields", () => {
    expect(shopSettingsReadSchema.parse(validSettings)).toEqual(validSettings);
    expect(() =>
      shopSettingsReadSchema.parse({ ...validSettings, currency: "PKR" }),
    ).toThrow();
    expect(() => shopSettingsSchema.parse(validSettings)).toThrow();
  });

  it("[AC-2] keeps service and price definitions versioned and strict", () => {
    expect(
      serviceDefinitionSchema.parse({
        schema_version: "service_definition.v1",
        configuration_schema: { size: { type: "string" } },
        required_artwork_purposes: ["print_source"],
        required_file_checks: ["malware_scan"],
        proof_approval_required: true,
        quote_required: false,
      }),
    ).toMatchObject({ proof_approval_required: true });
    expect(
      priceRuleSchema.parse({
        schema_version: "price_rule.v1",
        calculator: "test_standard_v1",
        parameters: { rate_paisa: "155" },
      }).parameters,
    ).toEqual({ rate_paisa: "155" });
    expect(() =>
      priceRuleSchema.parse({
        schema_version: "price_rule.v1",
        calculator: "test_standard_v1",
        parameters: { rate_paisa: "155.5" },
      }),
    ).toThrow();
  });

  it("[AC-8] retains measurement input while requiring positive decimal values", () => {
    const measurement = {
      entered_value: "2.500000",
      entered_unit: "cm" as const,
      normalized_mm: "25",
    };

    expect(measurementSchema.parse(measurement)).toEqual(measurement);
    expect(() =>
      measurementSchema.parse({ ...measurement, normalized_mm: "0" }),
    ).toThrow();
    expect(() =>
      measurementSchema.parse({ ...measurement, entered_unit: "meter" }),
    ).toThrow();
  });

  it("[AC-2] preserves exact calculation snapshot amounts", () => {
    const snapshot = {
      schema_version: "calculation_snapshot.v1" as const,
      components: [
        {
          rule: "test_standard_v1",
          inputs: { quantity: "3", taxable: false },
          amount_paisa: "9007199254740993",
        },
      ],
      subtotal_paisa: "9007199254740993",
      adjustment_paisa: "0",
      tax_label: "No tax",
      tax_paisa: "0",
      rounded_total_paisa: "9007199254741000",
    };

    expect(calculationSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(() =>
      calculationSnapshotSchema.parse({ ...snapshot, extra: true }),
    ).toThrow();
  });

  it("[AC-7] validates contact values and normalizes search values separately", () => {
    const contact = contactInputSchema.parse({
      name: "  Ayesha Khan  ",
      phone: "0300 1234567",
      email: "AYESHA@EXAMPLE.COM",
    });

    expect(contact).toEqual({
      name: "Ayesha Khan",
      phone: "0300 1234567",
      email: "AYESHA@EXAMPLE.COM",
    });
    expect(normalizeEmail(" AYESHA\u0301@EXAMPLE.COM ")).toBe(
      "ayeshá@example.com",
    );
    expect(normalizePakistanPhone(contact.phone)).toBe("+923001234567");
    expect(normalizePakistanPhone("923001234567")).toBe("+923001234567");
  });

  it("[AC-7] rejects invalid or ambiguous phone values", () => {
    expect(() => normalizePakistanPhone("0300-123-4567x99")).toThrow();
    expect(() => normalizePakistanPhone("00923001234567")).toThrow();
    expect(() => normalizePakistanPhone("0300")).toThrow();
  });
});
