import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local first (Next.js convention), fall back to .env
config({ path: ".env.local" });
config({ path: ".env" });

// drizzle-kit needs a direct (non-pooled) connection to introspect the schema.
// DIRECT_URL targets port 5432; DATABASE_URL targets the transaction pooler (6543).
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;

export default {
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
  verbose: true,
  strict: true,
} satisfies Config;
