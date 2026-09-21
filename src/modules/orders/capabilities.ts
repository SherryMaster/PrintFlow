import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { z } from "zod";

const envelopeSchema = z
  .object({
    iv: z.string().min(1),
    tag: z.string().min(1),
    ciphertext: z.string().min(1),
  })
  .strict();

function encryptionKey(rawKey: string): Buffer {
  const decoded = Buffer.from(rawKey, "base64");

  if (decoded.length !== 32) {
    throw new Error("LINK_PAYLOAD_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return decoded;
}

export function createCapability(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCapability(capability: string): string {
  return createHash("sha256").update(capability).digest("hex");
}

export function encryptCapability(capability: string, rawKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(rawKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(capability, "utf8"),
    cipher.final(),
  ]);

  return JSON.stringify({
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  });
}

export function decryptCapability(envelope: string, rawKey: string): string {
  const parsed = envelopeSchema.parse(JSON.parse(envelope));
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(rawKey),
    Buffer.from(parsed.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
