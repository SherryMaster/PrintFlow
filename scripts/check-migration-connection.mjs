import { resolve6 } from "node:dns/promises";
import { connect } from "node:net";

import nextEnvironment from "@next/env";

const { loadEnvConfig } = nextEnvironment;

loadEnvConfig(process.cwd());

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const directUrl = new URL(required("DATABASE_DIRECT_URL"));
const publicUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
required("DATABASE_CA_CERT");
const projectReference = publicUrl.hostname.split(".")[0];

if (
  directUrl.hostname !== `db.${projectReference}.supabase.co` ||
  directUrl.port !== "5432" ||
  decodeURIComponent(directUrl.username) !== "printflow_migrator"
) {
  throw new Error(
    "DATABASE_DIRECT_URL must be the matching direct Supabase endpoint on port 5432 with the printflow_migrator role",
  );
}

const addresses = await resolve6(directUrl.hostname);
if (addresses.length === 0) {
  throw new Error("The direct migration endpoint has no IPv6 address");
}

await new Promise((resolve, reject) => {
  const socket = connect({ host: addresses[0], port: 5432 });
  socket.setTimeout(10_000);
  socket.once("connect", () => {
    socket.destroy();
    resolve();
  });
  socket.once("timeout", () => {
    socket.destroy();
    reject(new Error("IPv6 migration connection timed out"));
  });
  socket.once("error", reject);
});

process.stdout.write(
  "Direct Supabase IPv6 migration connection is reachable\n",
);
