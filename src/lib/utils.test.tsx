import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("shared class composition", () => {
  it("[V6] keeps compatible utilities and removes conflicts", () => {
    expect(cn("text-sm font-medium", "text-base")).toBe(
      "font-medium text-base",
    );
  });
});
