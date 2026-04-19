import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load local .env defaults, but do not override DATABASE_URL already provided
// by the runtime environment (for example docker-compose service env).
config({ path: ".env", override: false });

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
