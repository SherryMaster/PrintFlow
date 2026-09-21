import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { readRuntimeDatabaseEnvironment } from "@/db/environment";
import * as schema from "@/db/schema";

type DatabaseClient = {
  db: PostgresJsDatabase<typeof schema>;
  sql: Sql;
};

let runtimeClient: DatabaseClient | undefined;

export function getDatabase(): DatabaseClient {
  if (runtimeClient) {
    return runtimeClient;
  }

  const environment = readRuntimeDatabaseEnvironment();
  const sql = postgres(environment.DATABASE_URL, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 300,
    ssl: {
      ca: environment.DATABASE_CA_CERT,
      rejectUnauthorized: true,
    },
    transform: {
      undefined: null,
    },
  });

  runtimeClient = {
    db: drizzle(sql, { schema }),
    sql,
  };

  return runtimeClient;
}
