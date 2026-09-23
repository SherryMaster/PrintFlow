import { describe, expect, it } from "vitest";

import { okPrintsBranding, pilotShopSettings } from "./branding";
import { okPrintsFixtureTheme } from "./fixtures";
import {
  contrastRatio,
  resolveShopTheme,
  safeAppTheme,
  semanticTokens,
  themeStyle,
} from "./theme";

const settings = {
  schema_version: "shop_settings.v2",
  quote_validity_days: 7,
  rounding_rule: "nearest_rupee_half_up",
  branding: okPrintsBranding,
};

describe("shop theme boundary", () => {
  it("[V1] keeps the pilot fixture complete and contrast safe", () => {
    const theme = okPrintsFixtureTheme;
    const settings = pilotShopSettings(7);
    const contrastPairs = [
      ["foreground", "background", 4.5],
      ["surfaceForeground", "surface", 4.5],
      ["mutedForeground", "muted", 4.5],
      ["primaryForeground", "primary", 4.5],
      ["secondaryForeground", "secondary", 4.5],
      ["accentForeground", "accent", 4.5],
      ["destructiveForeground", "destructive", 4.5],
      ["successForeground", "success", 4.5],
      ["warningForeground", "warning", 4.5],
      ["infoForeground", "info", 4.5],
      ["ring", "background", 3],
      ["input", "surface", 3],
    ] as const;

    expect(settings.branding.logo).toEqual({
      key: "branding/okprints/ok-prints.png",
      alt: "OkPrints logo",
    });
    expect(theme.identity.name).toBe("OkPrints");
    expect(Object.keys(theme.tokens).sort()).toEqual(
      [...semanticTokens].sort(),
    );
    for (const [foreground, background, minimum] of contrastPairs) {
      expect(
        contrastRatio(theme.tokens[foreground], theme.tokens[background]),
      ).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("[V1] keeps the fallback theme free of shop branding", () => {
    const theme = safeAppTheme("Shop name");

    expect(theme.identity).toEqual({ name: "Shop name" });
    expect(Object.keys(theme.tokens).sort()).toEqual(
      [...semanticTokens].sort(),
    );
  });

  it("resolves the approved pilot identity and a complete safe token set", () => {
    const { theme, warning } = resolveShopTheme({ name: "OkPrints", settings });
    expect(warning).toBeUndefined();
    expect(theme.identity.logo?.src).toBe("/branding/okprints/ok-prints.png");
    expect(Object.keys(theme.tokens).sort()).toEqual(
      [...semanticTokens].sort(),
    );
    expect(
      contrastRatio(theme.tokens.primary, theme.tokens.primaryForeground),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(theme.tokens.secondary, theme.tokens.secondaryForeground),
    ).toBeGreaterThanOrEqual(4.5);
    expect(themeStyle(theme)).not.toHaveProperty("--shop-id");
  });

  it("keeps a v1 row readable through the safe theme", () => {
    const settingsV1 = {
      schema_version: "shop_settings.v1",
      quote_validity_days: 7,
      rounding_rule: "nearest_rupee_half_up",
    };
    const before = JSON.stringify(settingsV1);
    const result = resolveShopTheme({ name: "Old shop", settings: settingsV1 });
    expect(result.warning).toBe("missing_or_invalid_branding");
    expect(result.theme.identity).toEqual({ name: "Old shop" });
    expect(JSON.stringify(settingsV1)).toBe(before);
  });

  it.each([
    ["invalid version", { ...settings, schema_version: "shop_settings.v3" }],
    [
      "malformed hex",
      {
        ...settings,
        branding: {
          ...okPrintsBranding,
          palette: { ...okPrintsBranding.palette, primary: "red" },
        },
      },
    ],
    [
      "missing logo",
      { ...settings, branding: { ...okPrintsBranding, logo: undefined } },
    ],
    [
      "unapproved asset",
      {
        ...settings,
        branding: {
          ...okPrintsBranding,
          logo: { key: "private/secret.png", alt: "Secret" },
        },
      },
    ],
    [
      "unsafe contrast",
      {
        ...settings,
        branding: {
          ...okPrintsBranding,
          palette: {
            ...okPrintsBranding.palette,
            ink: "#FFFFFF",
            paper: "#FFFFFF",
          },
        },
      },
    ],
  ])("falls back for %s", (_, candidate) => {
    const result = resolveShopTheme({ name: "OkPrints", settings: candidate });
    expect(result.warning).toBeDefined();
    expect(result.theme.identity.logo).toBeUndefined();
  });

  it.each([
    [
      "old settings version",
      { ...settings, schema_version: "shop_settings.v1" },
      "missing_or_invalid_branding",
    ],
    [
      "malformed color",
      {
        ...settings,
        branding: {
          ...okPrintsBranding,
          palette: { ...okPrintsBranding.palette, primary: "red" },
        },
      },
      "missing_or_invalid_branding",
    ],
    [
      "unapproved logo",
      {
        ...settings,
        branding: {
          ...okPrintsBranding,
          logo: { key: "private/secret.png", alt: "Secret" },
        },
      },
      "unapproved_brand_asset",
    ],
    [
      "unsafe foreground pairing",
      {
        ...settings,
        branding: {
          ...okPrintsBranding,
          palette: {
            ...okPrintsBranding.palette,
            ink: "#FFFFFF",
            paper: "#FFFFFF",
          },
        },
      },
      "unsafe_brand_contrast",
    ],
  ])("[V2] reports a structured warning for %s", (_, candidate, warning) => {
    expect(
      resolveShopTheme({ name: "OkPrints", settings: candidate }).warning,
    ).toBe(warning);
  });
});
