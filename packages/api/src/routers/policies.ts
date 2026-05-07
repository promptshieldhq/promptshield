import { policies } from "@promptshield/db";
import { env } from "@promptshield/env/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { readFile, stat, writeFile } from "fs/promises";
import { isIP } from "net";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireConfigAdmin } from "../admin-auth";
import {
  getEffectivePolicyPath,
  normalizePolicyPath,
  writeRuntimeConfig,
} from "../runtime-config";

function resolvePolicyPathOrThrow(pathValue: string): string {
  const resolved = normalizePolicyPath(pathValue);
  if (!resolved) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Policy path must be within allowed directories",
    });
  }
  return resolved;
}

type PolicySource = "local_file" | "gateway_api";

function getPolicySource(): PolicySource {
  return env.POLICY_SOURCE;
}

function isLoopbackHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === "localhost") return true;
  const version = isIP(host);
  if (version === 4) return host.startsWith("127.");
  if (version === 6) return lower === "::1";
  return false;
}

function assertPolicyGatewaySecurity(): void {
  const target = buildGatewayPolicyUrl();
  const parsed = new URL(target);

  if (!env.GATEWAY_ADMIN_TOKEN) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "GATEWAY_ADMIN_TOKEN is required when POLICY_SOURCE=gateway_api",
    });
  }

  if (parsed.protocol === "https:") return;
  if (parsed.protocol === "http:" && isLoopbackHost(parsed.hostname)) return;

  throw new TRPCError({
    code: "BAD_REQUEST",
    message:
      "Gateway policy endpoint must use HTTPS unless targeting localhost/loopback",
  });
}

function buildGatewayPolicyUrl(): string {
  return new URL(env.GATEWAY_POLICY_ENDPOINT, `${env.GATEWAY_URL}/`).toString();
}

function gatewayHeaders(contentType?: string): Record<string, string> {
  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    ...(env.GATEWAY_ADMIN_TOKEN
      ? { Authorization: `Bearer ${env.GATEWAY_ADMIN_TOKEN}` }
      : {}),
  };
}

async function parsePolicyResponseText(res: Response): Promise<string | null> {
  const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const data = (await res.json().catch(() => null)) as
      | { content?: unknown; policy?: unknown; yaml?: unknown }
      | null;
    const value = data?.content ?? data?.policy ?? data?.yaml;
    return typeof value === "string" ? value : null;
  }

  const text = await res.text().catch(() => "");
  return text || null;
}

function gatewayRequestError(status: number, bodyText: string): TRPCError {
  if (status === 401 || status === 403) {
    return new TRPCError({
      code: "FORBIDDEN",
      message: "Gateway policy endpoint rejected credentials",
    });
  }

  if (status === 404) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Gateway policy endpoint not found. Ensure promptshield-gateway exposes /admin/policy",
    });
  }

  return new TRPCError({
    code: "BAD_REQUEST",
    message: `Gateway policy request failed (${status})${bodyText ? `: ${bodyText.slice(0, 120)}` : ""}`,
  });
}

async function readPolicyFromGateway(): Promise<string | null> {
  assertPolicyGatewaySecurity();
  const url = buildGatewayPolicyUrl();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: gatewayHeaders(),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Unable to reach gateway policy endpoint",
    });
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw gatewayRequestError(res.status, bodyText);
  }

  return parsePolicyResponseText(res);
}

async function writePolicyToGateway(content: string): Promise<void> {
  assertPolicyGatewaySecurity();
  const url = buildGatewayPolicyUrl();

  const jsonAttempt = await fetch(url, {
    method: "PUT",
    headers: gatewayHeaders("application/json"),
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (jsonAttempt?.ok) return;

  if (
    jsonAttempt &&
    ![400, 404, 415].includes(jsonAttempt.status)
  ) {
    const bodyText = await jsonAttempt.text().catch(() => "");
    throw gatewayRequestError(jsonAttempt.status, bodyText);
  }

  const textAttempt = await fetch(url, {
    method: "PUT",
    headers: gatewayHeaders("text/plain"),
    body: content,
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (textAttempt?.ok) return;

  if (!textAttempt) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Unable to reach gateway policy endpoint",
    });
  }

  const bodyText = await textAttempt.text().catch(() => "");
  throw gatewayRequestError(textAttempt.status, bodyText);
}

async function readCurrentPolicyContent(): Promise<string | null> {
  if (getPolicySource() === "gateway_api") {
    return readPolicyFromGateway();
  }
  const filePath = await getEffectivePolicyPath();
  return readFile(filePath, "utf-8").catch(() => null);
}

async function writeCurrentPolicyContent(content: string): Promise<void> {
  if (getPolicySource() === "gateway_api") {
    await writePolicyToGateway(content);
    return;
  }
  const filePath = await getEffectivePolicyPath();
  await writeFile(filePath, content, "utf-8");
}

/*  Router */
export const policiesRouter = router({
  sourceInfo: protectedProcedure.query(async () => {
    const source = getPolicySource();
    if (source === "gateway_api") {
      assertPolicyGatewaySecurity();
    }
    return {
      source,
      gatewayUrl: env.GATEWAY_URL,
      gatewayPolicyEndpoint:
        source === "gateway_api" ? buildGatewayPolicyUrl() : null,
      hasGatewayAdminToken: Boolean(env.GATEWAY_ADMIN_TOKEN),
    };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(policies)
      .where(eq(policies.userId, ctx.session.user.id))
      .orderBy(desc(policies.createdAt));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [policy] = await ctx.db
        .select()
        .from(policies)
        .where(
          and(
            eq(policies.id, input.id),
            eq(policies.userId, ctx.session.user.id),
          ),
        );
      return policy ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        content: z.string().min(1),
        isDefault: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireConfigAdmin(ctx.session, env.CONFIG_ADMIN_EMAILS);
      const [created] = await ctx.db
        .insert(policies)
        .values({
          name: input.name,
          content: input.content,
          userId: ctx.session.user.id,
          isDefault: input.isDefault,
        })
        .returning();

      if (input.isDefault) {
        await writeCurrentPolicyContent(input.content).catch((e) => {
          console.error("[policies] failed to write policy file on create:", e);
        });
      }

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        content: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireConfigAdmin(ctx.session, env.CONFIG_ADMIN_EMAILS);
      const updates: Partial<typeof policies.$inferInsert> = {};
      if (input.name) updates.name = input.name;
      if (input.content) updates.content = input.content;

      const [updated] = await ctx.db
        .update(policies)
        .set(updates)
        .where(
          and(
            eq(policies.id, input.id),
            eq(policies.userId, ctx.session.user.id),
          ),
        )
        .returning();

      if (updated?.isDefault && input.content) {
        await writeCurrentPolicyContent(input.content).catch((e) => {
          console.error("[policies] failed to write policy file on update:", e);
        });
      }

      return updated;
    }),

  syncFromFile: protectedProcedure.mutation(async ({ ctx }) => {
    requireConfigAdmin(ctx.session, env.CONFIG_ADMIN_EMAILS);
    const content = await readCurrentPolicyContent().catch(() => null);
    if (!content) return null;

    const [existing] = await ctx.db
      .select()
      .from(policies)
      .where(
        and(
          eq(policies.userId, ctx.session.user.id),
          eq(policies.isDefault, true),
        ),
      );

    if (existing) {
      const [updated] = await ctx.db
        .update(policies)
        .set({ content })
        .where(eq(policies.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await ctx.db
      .insert(policies)
      .values({
        name: "Default Policy",
        content,
        userId: ctx.session.user.id,
        isDefault: true,
      })
      .returning();
    return created;
  }),

  fileMeta: protectedProcedure.query(async () => {
    const source = getPolicySource();

    if (source === "gateway_api") {
      const path = buildGatewayPolicyUrl();
      try {
        const content = await readPolicyFromGateway();
        return {
          source,
          path,
          exists: true,
          sizeBytes: content ? Buffer.byteLength(content, "utf-8") : 0,
          modifiedAt: null,
        };
      } catch {
        return {
          source,
          path,
          exists: false,
          sizeBytes: null,
          modifiedAt: null,
        };
      }
    }

    const filePath = await getEffectivePolicyPath();
    try {
      const s = await stat(filePath);
      return {
        source,
        path: filePath,
        exists: true,
        sizeBytes: s.size,
        modifiedAt: s.mtime.toISOString(),
      };
    } catch {
      return {
        source,
        path: filePath,
        exists: false,
        sizeBytes: null,
        modifiedAt: null,
      };
    }
  }),

  checkFilePath: protectedProcedure
    .input(z.object({ path: z.string().min(1) }))
    .mutation(async ({ input }) => {
      if (getPolicySource() === "gateway_api") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Policy path editing is disabled when POLICY_SOURCE=gateway_api",
        });
      }

      const safePath = resolvePolicyPathOrThrow(input.path);
      try {
        const s = await stat(safePath);
        return {
          exists: true,
          sizeBytes: s.size,
          modifiedAt: s.mtime.toISOString(),
        };
      } catch {
        return { exists: false, sizeBytes: null, modifiedAt: null };
      }
    }),

  saveFilePath: protectedProcedure
    .input(z.object({ path: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireConfigAdmin(ctx.session, env.CONFIG_ADMIN_EMAILS);
      if (getPolicySource() === "gateway_api") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Policy path editing is disabled when POLICY_SOURCE=gateway_api",
        });
      }

      const safePath = resolvePolicyPathOrThrow(input.path);
      await writeRuntimeConfig({ policyFilePath: safePath });
      return { saved: true, path: safePath };
    }),

  getCurrentFile: protectedProcedure.query(async () => {
    const source = getPolicySource();

    if (source === "gateway_api") {
      const content = await readPolicyFromGateway();
      return { content, source, target: buildGatewayPolicyUrl() };
    }

    const filePath = await getEffectivePolicyPath();
    const content = await readFile(filePath, "utf-8").catch(() => null);
    return { content, source, target: filePath };
  }),

  saveToFile: protectedProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireConfigAdmin(ctx.session, env.CONFIG_ADMIN_EMAILS);
      await writeCurrentPolicyContent(input.content);
      return { success: true };
    }),
});
