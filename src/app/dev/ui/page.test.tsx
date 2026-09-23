import { afterEach, describe, expect, it, vi } from "vitest";

import { notFound } from "next/navigation";
import UiShowcase from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("UI showcase route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("[V6] returns a not found response in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => UiShowcase()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("[V6] remains available as a development showcase", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(() => UiShowcase()).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});
