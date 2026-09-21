import { createHash } from "node:crypto";

import { z } from "zod";

export const domainErrorCodes = [
  "not_found",
  "forbidden",
  "stale_version",
  "invalid_transition",
  "conflict",
  "validation_failed",
  "expired",
  "superseded",
  "quarantined",
  "erased",
  "stale_lease",
] as const;

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export type DomainError = {
  code: DomainErrorCode;
  message: string;
  path?: readonly (string | number)[];
};

export type Result<T> =
  { ok: true; value: T } | { ok: false; error: DomainError };

export const moneyStringSchema = z
  .string()
  .regex(/^-?\d+$/, "Money must be a decimal paisa string");

export const positiveNumericStringSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/, "Use a positive decimal with at most 6 places")
  .refine((value) => value !== "0" && !/^0(?:\.0+)?$/.test(value), {
    message: "Value must be greater than zero",
  });

function canonicalize(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString(10);
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function requestFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function roundToNearestRupee(paisa: bigint): bigint {
  if (paisa < 0n) {
    throw new Error("A final job amount cannot be negative");
  }

  return ((paisa + 50n) / 100n) * 100n;
}
