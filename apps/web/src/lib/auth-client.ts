import { env } from "@promptshield/env/web";
import { createAuthClient } from "better-auth/react";

// Use SSR_SERVER_URL in Docker SSR; localhost points to the web container.
const baseURL =
  typeof window === "undefined"
    ? (process.env.SSR_SERVER_URL ?? env.VITE_SERVER_URL)
    : env.VITE_SERVER_URL;

export const authClient = createAuthClient({
  baseURL,
});
