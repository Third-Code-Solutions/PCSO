import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

// Load .env.local first (Next.js convention), fall back to .env
config({ path: '.env.local' });
config({ path: '.env' });

export default {
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
