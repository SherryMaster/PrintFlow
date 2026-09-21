import { z } from "zod";

const runtimeEnvironmentSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_CA_CERT: z.string().min(1),
});

const migrationEnvironmentSchema = runtimeEnvironmentSchema.extend({
  DATABASE_DIRECT_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
});

export type RuntimeDatabaseEnvironment = z.infer<
  typeof runtimeEnvironmentSchema
>;

function projectReference(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname;
  const [reference, ...rest] = host.split(".");

  if (!reference || rest.join(".") !== "supabase.co") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a Supabase project URL");
  }

  return reference;
}

export function readRuntimeDatabaseEnvironment(
  environment: Record<string, string | undefined> = process.env,
): RuntimeDatabaseEnvironment {
  return runtimeEnvironmentSchema.parse(environment);
}

export function readMigrationDatabaseEnvironment(
  environment: Record<string, string | undefined> = process.env,
) {
  const parsed = migrationEnvironmentSchema.parse(environment);
  const directUrl = new URL(parsed.DATABASE_DIRECT_URL);
  const reference = projectReference(parsed.NEXT_PUBLIC_SUPABASE_URL);

  if (
    directUrl.hostname !== `db.${reference}.supabase.co` ||
    directUrl.port !== "5432"
  ) {
    throw new Error(
      "DATABASE_DIRECT_URL must use the matching direct Supabase endpoint on port 5432",
    );
  }

  if (decodeURIComponent(directUrl.username) !== "printflow_migrator") {
    throw new Error(
      "DATABASE_DIRECT_URL must authenticate as printflow_migrator",
    );
  }

  return parsed;
}
