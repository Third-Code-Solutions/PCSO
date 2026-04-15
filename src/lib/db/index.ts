import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

/**
 * Singleton postgres connection.
 * In production (non-serverless) this is a persistent pool.
 * In serverless environments set max: 1 to avoid connection exhaustion.
 */
// Detect if we're connected through Supabase's transaction pooler (port 6543).
// Transaction pooling does NOT support prepared statements, so we must disable them.
// Session pooler (5432) and direct connections DO support prepared statements.
const isTransactionPooler = connectionString.includes(':6543');

const client = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 10 : 5,
  idle_timeout: 30,
  connect_timeout: 30,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  prepare: !isTransactionPooler,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;

// Re-export schema for convenience
export * from './schema';
