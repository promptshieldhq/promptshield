import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    ENGINE_URL: z.string().url().default("http://localhost:4321"),
    ENGINE_API_KEY: z.string().min(1).optional(),
    PROXY_URL: z.string().url().default("http://localhost:8080"),
    PROXY_CONFIG_SOURCE: z
      .enum(["local_env", "proxy_api"])
      .default("local_env"),
    PROXY_CONFIG_ENDPOINT: z
      .string()
      .min(1)
      .default("/admin/config")
      .refine((value) => value.startsWith("/"), {
        message: "PROXY_CONFIG_ENDPOINT must start with '/'",
      }),
    POLICY_SOURCE: z.enum(["local_file", "proxy_api"]).default("local_file"),
    PROXY_POLICY_ENDPOINT: z
      .string()
      .min(1)
      .default("/admin/policy")
      .refine((value) => value.startsWith("/"), {
        message: "PROXY_POLICY_ENDPOINT must start with '/'",
      }),
    PROXY_ADMIN_TOKEN: z.string().min(1).optional(),
    CONFIG_ADMIN_EMAILS: z.string().optional(),
    POLICY_FILE_PATH: z.string().default("../../config/policy.yaml"),
    POLICY_ALLOWED_DIRS: z.string().optional(),
    PROXY_ENV_PATH: z.string().default("../../config/proxy.env"),
    AUDIT_INGEST_SECRET: z.string().min(16),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
