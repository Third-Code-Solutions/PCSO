#!/usr/bin/env tsx
/**
 * Applies .sql files to the database via postgres-js.
 * Use in place of `psql` since macOS Node setups don't include psql by default.
 *
 * Usage:
 *   npx tsx scripts/apply-sql.ts supabase/rls-policies.sql supabase/indexes.sql supabase/triggers/sync-users.sql
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

config({ path: '.env.local' });
config({ path: '.env' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Populate .env.local and retry.');
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: tsx scripts/apply-sql.ts <file.sql> [more.sql ...]');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

async function run() {
  for (const file of files) {
    console.log(`\n▶ Applying ${file}`);
    const content = readFileSync(file, 'utf8');
    try {
      await sql.unsafe(content);
      console.log(`✓ ${file} applied`);
    } catch (err) {
      console.error(`✗ ${file} failed:`, err instanceof Error ? err.message : err);
      await sql.end();
      process.exit(1);
    }
  }
  await sql.end();
  console.log('\n✓ All SQL files applied successfully');
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
