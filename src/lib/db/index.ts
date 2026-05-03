import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type PostgresClient = ReturnType<typeof postgres>;
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _client: PostgresClient | null = null;
let _db: DrizzleDb | null = null;

function init(): { client: PostgresClient; db: DrizzleDb } {
  if (_db && _client) return { client: _client, db: _db };

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const isTransactionPooler = connectionString.includes(":6543");
  _client = postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 30,
    connect_timeout: 30,
    ssl: connectionString.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : false,
    prepare: !isTransactionPooler,
  });
  _db = drizzle(_client, { schema });
  return { client: _client, db: _db };
}

export const db = new Proxy({} as DrizzleDb, {
  get(_, prop, receiver) {
    const instance = init().db;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export const dbClient = new Proxy({} as PostgresClient, {
  get(_, prop, receiver) {
    const instance = init().client;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type Database = DrizzleDb;

// Re-export schema for convenience
export * from "./schema";
