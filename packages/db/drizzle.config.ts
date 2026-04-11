import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env", override: true });

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
