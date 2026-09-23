import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const shopBrandingSchema = z
  .object({
    schema_version: z.literal("shop_branding.v1"),
    logo: z.object({ key: z.string().min(1), alt: z.string().min(1) }).strict(),
    tagline: z.string().trim().min(1).max(120).optional(),
    palette: z
      .object({
        primary: hexColor,
        supporting_red: hexColor,
        ink: hexColor,
        paper: hexColor,
        accent: hexColor.optional(),
      })
      .strict(),
  })
  .strict();

export const shopSettingsV1Schema = z
  .object({
    schema_version: z.literal("shop_settings.v1"),
    quote_validity_days: z.int().positive(),
    rounding_rule: z.literal("nearest_rupee_half_up"),
  })
  .strict();

export const shopSettingsSchema = z
  .object({
    schema_version: z.literal("shop_settings.v2"),
    quote_validity_days: z.int().positive(),
    rounding_rule: z.literal("nearest_rupee_half_up"),
    branding: shopBrandingSchema,
  })
  .strict();

export const shopSettingsReadSchema = z.union([
  shopSettingsV1Schema,
  shopSettingsSchema,
]);

export const approvedBrandAssets = {
  "branding/okprints/ok-prints.png": "/branding/okprints/ok-prints.png",
} as const;

export const okPrintsBranding: z.infer<typeof shopBrandingSchema> = {
  schema_version: "shop_branding.v1",
  logo: { key: "branding/okprints/ok-prints.png", alt: "OkPrints logo" },
  palette: {
    primary: "#ED3237",
    supporting_red: "#C52F33",
    ink: "#0A0500",
    paper: "#FDFDFD",
    accent: "#504E4A",
  },
};

export function pilotShopSettings(
  quoteValidityDays: number,
): z.infer<typeof shopSettingsSchema> {
  return shopSettingsSchema.parse({
    schema_version: "shop_settings.v2",
    quote_validity_days: quoteValidityDays,
    rounding_rule: "nearest_rupee_half_up",
    branding: okPrintsBranding,
  });
}
