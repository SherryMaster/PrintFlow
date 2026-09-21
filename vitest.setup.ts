import { loadEnvConfig } from "@next/env";
import "@testing-library/jest-dom/vitest";

if (
  process.env.RUN_DATABASE_TESTS === "1" ||
  process.env.RUN_CAPACITY_TESTS === "1"
) {
  const testNodeEnv = process.env.NODE_ENV;
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  mutableEnvironment.NODE_ENV = "development";
  loadEnvConfig(process.cwd());
  if (testNodeEnv === undefined) {
    delete mutableEnvironment.NODE_ENV;
  } else {
    mutableEnvironment.NODE_ENV = testNodeEnv;
  }
}
