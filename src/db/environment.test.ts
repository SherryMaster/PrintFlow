import { describe, expect, it } from "vitest";

import {
  readMigrationDatabaseEnvironment,
  readRuntimeDatabaseEnvironment,
} from "@/db/environment";

const baseEnvironment = {
  DATABASE_URL:
    "postgres://printflow_app:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
  DATABASE_DIRECT_URL:
    "postgres://printflow_migrator:secret@db.abcdefgh.supabase.co:5432/postgres",
  DATABASE_CA_CERT: "certificate",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
};

describe("database environment", () => {
  it("accepts the matching direct Supabase migration endpoint", () => {
    expect(readMigrationDatabaseEnvironment(baseEnvironment)).toMatchObject({
      DATABASE_DIRECT_URL: baseEnvironment.DATABASE_DIRECT_URL,
    });
  });

  it("rejects a pooler or another project before migration", () => {
    expect(() =>
      readMigrationDatabaseEnvironment({
        ...baseEnvironment,
        DATABASE_DIRECT_URL:
          "postgres://printflow_migrator:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
      }),
    ).toThrow(/direct Supabase endpoint/);
    expect(() =>
      readMigrationDatabaseEnvironment({
        ...baseEnvironment,
        DATABASE_DIRECT_URL:
          "postgres://printflow_migrator:secret@db.different.supabase.co:5432/postgres",
      }),
    ).toThrow(/direct Supabase endpoint/);
  });

  it("requires the dedicated migration role and CA", () => {
    expect(() =>
      readMigrationDatabaseEnvironment({
        ...baseEnvironment,
        DATABASE_DIRECT_URL:
          "postgres://postgres:secret@db.abcdefgh.supabase.co:5432/postgres",
      }),
    ).toThrow(/printflow_migrator/);
    expect(() =>
      readRuntimeDatabaseEnvironment({
        DATABASE_URL: baseEnvironment.DATABASE_URL,
      }),
    ).toThrow();
  });
});
