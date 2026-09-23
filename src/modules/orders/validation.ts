import { z } from "zod";

import { moneyStringSchema, positiveNumericStringSchema } from "@/db/contracts";
export {
  shopSettingsV1Schema,
  shopSettingsSchema,
  shopSettingsReadSchema,
} from "@/ui/theme/branding";

export const serviceDefinitionSchema = z
  .object({
    schema_version: z.literal("service_definition.v1"),
    configuration_schema: z.record(z.string(), z.unknown()),
    required_artwork_purposes: z.array(z.string().min(1)),
    required_file_checks: z.array(z.string().min(1)),
    proof_approval_required: z.boolean(),
    quote_required: z.boolean(),
  })
  .strict();

export const priceRuleSchema = z
  .object({
    schema_version: z.literal("price_rule.v1"),
    calculator: z.string().min(1),
    parameters: z.record(z.string(), moneyStringSchema),
  })
  .strict();

export const measurementSchema = z
  .object({
    entered_value: positiveNumericStringSchema,
    entered_unit: z.enum(["mm", "cm", "in", "ft"]),
    normalized_mm: positiveNumericStringSchema,
  })
  .strict();

export const calculationSnapshotSchema = z
  .object({
    schema_version: z.literal("calculation_snapshot.v1"),
    components: z.array(
      z
        .object({
          rule: z.string().min(1),
          inputs: z.record(z.string(), z.union([z.string(), z.boolean()])),
          amount_paisa: moneyStringSchema,
        })
        .strict(),
    ),
    subtotal_paisa: moneyStringSchema,
    adjustment_paisa: moneyStringSchema,
    tax_label: z.string(),
    tax_paisa: moneyStringSchema,
    rounded_total_paisa: moneyStringSchema,
  })
  .strict();

export const contactInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(1).max(40),
    email: z.email().optional(),
  })
  .strict();

export function normalizeEmail(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

export function normalizePakistanPhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  const normalized = compact.startsWith("03")
    ? `+92${compact.slice(1)}`
    : compact.startsWith("92")
      ? `+${compact}`
      : compact;

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Phone number must be a valid unambiguous E.164 value");
  }

  return normalized;
}
