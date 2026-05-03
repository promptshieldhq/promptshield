import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@promptshield/api/context";
import { appRouter } from "@promptshield/api/routers/index";
import { auth } from "@promptshield/auth";
import { auditEvents } from "@promptshield/db";
import { env } from "@promptshield/env/server";
import { db } from "@promptshield/db";
import { createHmac, timingSafeEqual } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

const app = new Hono<{ Variables: { session: AuthSession } }>();

const MAX_AUDIT_INGEST_BODY_BYTES = 1 << 20; // 1 MiB
const MAX_AUDIT_INGEST_LINES = 5000;
const MAX_POLICY_BODY_BYTES = 1 << 20; // 1 MiB
const MAX_ENGINE_DETECT_BODY_BYTES = 1 << 20; // 1 MiB

const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,
  allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "x-trpc-source",
    "x-ingest-secret",
  ],
  credentials: true,
});

app.use(logger());
app.use("/*", corsMiddleware);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

// Normalize secrets before timingSafeEqual to avoid length-based timing leaks.
const _HMAC_KEY = "promptshield-secret-compare";
function secretsMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const h1 = createHmac("sha256", _HMAC_KEY).update(provided).digest();
  const h2 = createHmac("sha256", _HMAC_KEY).update(expected).digest();
  return timingSafeEqual(h1, h2);
}

function jsonWithStatus(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function splitConfigAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isConfigAdminSession(session: AuthSession | null | undefined): boolean {
  const configured = splitConfigAdminEmails(env.CONFIG_ADMIN_EMAILS);
  if (configured.length === 0) return false;

  const email =
    typeof session?.user?.email === "string"
      ? session.user.email.toLowerCase()
      : "";

  return Boolean(email && configured.includes(email));
}

// Register this route before session middleware so the secret check works.
app.post("/internal/audit/ingest", async (c) => {
  const provided = c.req.header("x-ingest-secret");
  if (!secretsMatch(provided, env.AUDIT_INGEST_SECRET)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return c.json({ error: "Invalid Content-Length" }, 400);
    }
    if (contentLength > MAX_AUDIT_INGEST_BODY_BYTES) {
      return c.json({ error: "Payload too large" }, 413);
    }
  }

  const body = await c.req.text();
  if (Buffer.byteLength(body, "utf-8") > MAX_AUDIT_INGEST_BODY_BYTES) {
    return c.json({ error: "Payload too large" }, 413);
  }

  const lines = body.split("\n").filter(Boolean);
  if (lines.length > MAX_AUDIT_INGEST_LINES) {
    return c.json({ error: "Too many records in a single ingest request" }, 413);
  }
  const rows: (typeof auditEvents.$inferInsert)[] = [];

  function normalizeAction(action: unknown):
    | "allowed"
    | "blocked"
    | "masked"
    | "warned"
    | null {
    if (action === "allow") return "allowed";
    if (action === "block") return "blocked";
    if (action === "mask") return "masked";
    if (action === "warn") return "warned";
    if (
      action === "allowed" ||
      action === "blocked" ||
      action === "masked" ||
      action === "warned"
    ) {
      return action;
    }
    return null;
  }

  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const action = normalizeAction(e.action);
      if (!action) {
        continue;
      }

      rows.push({
        keyId: e.api_key_id ?? null,
        action,
        requestId: e.request_id ?? null,
        entityTypes: Array.isArray(e.entities_detected)
          ? e.entities_detected
          : [],
        model: e.model ?? null,
        provider: e.provider ?? null,
        contentHash: null,
        timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      });
    } catch {
      // skip malformed lines
    }
  }

  if (rows.length > 0) await db.insert(auditEvents).values(rows).onConflictDoNothing();
  return c.json({ inserted: rows.length });
});

// Require a valid session for all other /internal/* routes
app.use("/internal/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("session", session);
  await next();
});

// Internal proxy routes — forward to promptshield-engine
app.get("/internal/engine/health", async (c) => {
  try {
    const res = await fetch(`${env.ENGINE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return jsonWithStatus(data, res.status);
  } catch {
    return c.json({ error: "Engine unreachable" }, 503);
  }
});

app.get("/internal/engine/ready", async (c) => {
  try {
    const res = await fetch(`${env.ENGINE_URL}/ready`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return jsonWithStatus(data, res.status);
  } catch {
    return c.json({ error: "Engine unreachable" }, 503);
  }
});

app.post("/internal/engine/detect", async (c) => {
  const rawBody = await c.req.text();
  if (Buffer.byteLength(rawBody, "utf-8") > MAX_ENGINE_DETECT_BODY_BYTES) {
    return c.json({ error: "Payload too large" }, 413);
  }
  try {
    const body = JSON.parse(rawBody);
    const res = await fetch(`${env.ENGINE_URL}/detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.ENGINE_API_KEY
          ? { Authorization: `Bearer ${env.ENGINE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return jsonWithStatus(data, res.status);
  } catch {
    return c.json({ error: "Engine unreachable" }, 503);
  }
});

app.post("/internal/engine/config", async (c) => {
  const session = c.get("session");
  if (!isConfigAdminSession(session)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const body = await c.req.json();
    const res = await fetch(`${env.ENGINE_URL}/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.ENGINE_API_KEY
          ? { Authorization: `Bearer ${env.ENGINE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return jsonWithStatus(data, res.status);
  } catch {
    return c.json({ error: "Engine unreachable" }, 503);
  }
});

// Internal policy routes — read/write policy.yaml
app.get("/internal/policy", async (c) => {
  const session = c.get("session");
  if (!isConfigAdminSession(session)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const content = await readFile(env.POLICY_FILE_PATH, "utf-8");
    return c.json({ content });
  } catch {
    return c.json({ content: null, error: "Policy file not found" }, 404);
  }
});

app.put("/internal/policy", async (c) => {
  const session = c.get("session");
  if (!isConfigAdminSession(session)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const rawBody = await c.req.text();
    if (Buffer.byteLength(rawBody, "utf-8") > MAX_POLICY_BODY_BYTES) {
      return c.json({ error: "Payload too large" }, 413);
    }
    const { content } = JSON.parse(rawBody);
    await writeFile(env.POLICY_FILE_PATH, content, "utf-8");
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to write policy file" }, 500);
  }
});

// Proxy health check
app.get("/internal/proxy/health", async (c) => {
  try {
    const res = await fetch(`${env.PROXY_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return jsonWithStatus({ online: res.ok, url: env.PROXY_URL }, res.status);
  } catch {
    return c.json({ online: false, url: env.PROXY_URL }, 503);
  }
});

app.get("/", (c) => c.text("OK"));

export default app;
