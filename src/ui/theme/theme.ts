import type { CSSProperties } from "react";
import { approvedBrandAssets, shopSettingsReadSchema } from "./branding";

export const semanticTokens = [
  "background",
  "foreground",
  "surface",
  "surfaceForeground",
  "muted",
  "mutedForeground",
  "border",
  "input",
  "ring",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "accent",
  "accentForeground",
  "destructive",
  "destructiveForeground",
  "success",
  "successForeground",
  "warning",
  "warningForeground",
  "info",
  "infoForeground",
] as const;

export type SemanticToken = (typeof semanticTokens)[number];
export type ResolvedTheme = {
  meta: { schemaVersion: "resolved_theme.v1"; colorScheme: "light" };
  identity: {
    name: string;
    tagline?: string;
    logo?: { src: string; alt: string };
  };
  tokens: Record<SemanticToken, string>;
};

const safePalette = {
  primary: "#0A0500",
  supporting_red: "#504E4A",
  ink: "#0A0500",
  paper: "#FDFDFD",
  accent: "#504E4A",
};

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function makeTokens(
  palette: Omit<typeof safePalette, "accent"> & { accent?: string },
): Record<SemanticToken, string> {
  const white = "#FFFFFF";
  const primaryForeground =
    contrastRatio(palette.primary, palette.ink) >= 4.5
      ? palette.ink
      : palette.paper;
  const supportingForeground =
    contrastRatio(palette.supporting_red, palette.paper) >= 4.5
      ? palette.paper
      : palette.ink;
  return {
    background: palette.paper,
    foreground: palette.ink,
    surface: white,
    surfaceForeground: palette.ink,
    muted: "#EDEFF2",
    mutedForeground: "#504E4A",
    border: "#AAA7A5",
    input: "#777370",
    ring: palette.supporting_red,
    primary: palette.primary,
    primaryForeground,
    secondary: palette.supporting_red,
    secondaryForeground: supportingForeground,
    accent: "#EDEFF2",
    accentForeground: palette.ink,
    destructive: "#A3252A",
    destructiveForeground: white,
    success: "#1C6842",
    successForeground: white,
    warning: "#805200",
    warningForeground: white,
    info: "#245A85",
    infoForeground: white,
  };
}

function tokensAreSafe(tokens: Record<SemanticToken, string>): boolean {
  const pairs: [SemanticToken, SemanticToken, number][] = [
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
  ];
  return pairs.every(
    ([a, b, minimum]) => contrastRatio(tokens[a], tokens[b]) >= minimum,
  );
}

export function safeAppTheme(name: string): ResolvedTheme {
  return {
    meta: { schemaVersion: "resolved_theme.v1", colorScheme: "light" },
    identity: { name },
    tokens: makeTokens(safePalette),
  };
}

export function resolveShopTheme(input: { name: string; settings: unknown }): {
  theme: ResolvedTheme;
  warning?: string;
} {
  const parsed = shopSettingsReadSchema.safeParse(input.settings);
  if (!parsed.success || parsed.data.schema_version !== "shop_settings.v2")
    return {
      theme: safeAppTheme(input.name),
      warning: "missing_or_invalid_branding",
    };
  const { branding } = parsed.data;
  const logoSrc =
    approvedBrandAssets[branding.logo.key as keyof typeof approvedBrandAssets];
  if (!logoSrc)
    return {
      theme: safeAppTheme(input.name),
      warning: "unapproved_brand_asset",
    };
  const tokens = makeTokens(branding.palette);
  if (!tokensAreSafe(tokens))
    return {
      theme: safeAppTheme(input.name),
      warning: "unsafe_brand_contrast",
    };
  return {
    theme: {
      meta: { schemaVersion: "resolved_theme.v1", colorScheme: "light" },
      identity: {
        name: input.name,
        tagline: branding.tagline,
        logo: { src: logoSrc, alt: branding.logo.alt },
      },
      tokens,
    },
  };
}

const cssTokenNames: Record<SemanticToken, string> = {
  background: "background",
  foreground: "foreground",
  surface: "card",
  surfaceForeground: "card-foreground",
  muted: "muted",
  mutedForeground: "muted-foreground",
  border: "border",
  input: "input",
  ring: "ring",
  primary: "primary",
  primaryForeground: "primary-foreground",
  secondary: "secondary",
  secondaryForeground: "secondary-foreground",
  accent: "accent",
  accentForeground: "accent-foreground",
  destructive: "destructive",
  destructiveForeground: "destructive-foreground",
  success: "success",
  successForeground: "success-foreground",
  warning: "warning",
  warningForeground: "warning-foreground",
  info: "info",
  infoForeground: "info-foreground",
};

export function themeStyle(theme: ResolvedTheme): CSSProperties {
  return Object.fromEntries(
    semanticTokens.map((key) => [`--${cssTokenNames[key]}`, theme.tokens[key]]),
  ) as CSSProperties;
}
