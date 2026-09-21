import { describe, expect, it } from "vitest";

import {
  createCapability,
  decryptCapability,
  encryptCapability,
  hashCapability,
} from "@/modules/orders/capabilities";

describe("capabilities", () => {
  it("stores a hash and authenticated encrypted delivery payload", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const capability = createCapability();
    const encrypted = encryptCapability(capability, key);

    expect(capability).toHaveLength(43);
    expect(hashCapability(capability)).toMatch(/^[a-f0-9]{64}$/);
    expect(encrypted).not.toContain(capability);
    expect(decryptCapability(encrypted, key)).toBe(capability);
  });

  it("rejects tampered ciphertext", () => {
    const key = Buffer.alloc(32, 9).toString("base64");
    const encrypted = encryptCapability(createCapability(), key);
    const envelope = JSON.parse(encrypted) as { ciphertext: string };
    envelope.ciphertext = `${envelope.ciphertext[0] === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}`;

    expect(() => decryptCapability(JSON.stringify(envelope), key)).toThrow();
  });

  it("[AC-10] rejects a wrong key and malformed key length", () => {
    const key = Buffer.alloc(32, 5).toString("base64");
    const wrongKey = Buffer.alloc(32, 6).toString("base64");
    const encrypted = encryptCapability("guest-capability", key);

    expect(() => decryptCapability(encrypted, wrongKey)).toThrow();
    expect(() => encryptCapability("guest-capability", "bad-key")).toThrow(
      /32 bytes/,
    );
  });
});
