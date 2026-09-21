import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { readMigrationDatabaseEnvironment } from "./src/db/environment";

loadEnvConfig(process.cwd());

const environment = readMigrationDatabaseEnvironment();
const directUrl = new URL(environment.DATABASE_DIRECT_URL);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: directUrl.hostname,
    port: Number(directUrl.port),
    user: decodeURIComponent(directUrl.username),
    password: decodeURIComponent(directUrl.password),
    database: directUrl.pathname.slice(1),
    ssl: {
      ca: environment.DATABASE_CA_CERT,
      rejectUnauthorized: true,
      servername: directUrl.hostname,
    },
  },
  migrations: {
    schema: "app",
    table: "__drizzle_migrations",
  },
  strict: true,
  verbose: true,
});
