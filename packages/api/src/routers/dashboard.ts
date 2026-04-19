import { auditEvents, apiKeys } from "@promptshield/db";
import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { env } from "@promptshield/env/server";

import { protectedProcedure, router } from "../index";
import { isConfigAdmin } from "../admin-auth";

const dateRangeInput = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

function ownedAuditCondition(userId: string) {
  return and(
    isNotNull(auditEvents.keyId),
    sql`
      exists (
        select 1
        from ${apiKeys}
        where ${apiKeys.id} = ${auditEvents.keyId}
          and ${apiKeys.userId} = ${userId}
      )
    `,
  );
}

function scopedAuditCondition(userId: string, includeUnkeyed: boolean) {
  const owned = ownedAuditCondition(userId);
  return includeUnkeyed ? or(owned, isNull(auditEvents.keyId)) : owned;
}

export const dashboardRouter = router({
  stats: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      // Default: start of today
      const from = input.dateFrom
        ? new Date(input.dateFrom)
        : (() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d;
          })();
      const to = input.dateTo ? new Date(input.dateTo) : undefined;
      const userId = ctx.session.user.id;
      const includeUnkeyed =
        env.NODE_ENV === "development" ||
        isConfigAdmin(ctx.session, env.CONFIG_ADMIN_EMAILS);

      const timeConditions = [gte(auditEvents.timestamp, from)];
      if (to) timeConditions.push(lte(auditEvents.timestamp, to));

      const scopedCondition = scopedAuditCondition(userId, includeUnkeyed);

      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(auditEvents)
        .where(and(...timeConditions, scopedCondition));

      const [blockedResult] = await ctx.db
        .select({ count: count() })
        .from(auditEvents)
        .where(
          and(
            ...timeConditions,
            eq(auditEvents.action, "blocked"),
            scopedCondition,
          ),
        );

      const [allowedResult] = await ctx.db
        .select({ count: count() })
        .from(auditEvents)
        .where(
          and(
            ...timeConditions,
            eq(auditEvents.action, "allowed"),
            scopedCondition,
          ),
        );

      const [maskedResult] = await ctx.db
        .select({ count: count() })
        .from(auditEvents)
        .where(
          and(
            ...timeConditions,
            eq(auditEvents.action, "masked"),
            scopedCondition,
          ),
        );

      const [warnedResult] = await ctx.db
        .select({ count: count() })
        .from(auditEvents)
        .where(
          and(
            ...timeConditions,
            eq(auditEvents.action, "warned"),
            scopedCondition,
          ),
        );

      const [activeKeysResult] = await ctx.db
        .select({ count: count() })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));

      const [totalKeysResult] = await ctx.db
        .select({ count: count() })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));

      const [keysWithPolicyResult] = await ctx.db
        .select({ count: count() })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.userId, userId),
            isNull(apiKeys.revokedAt),
            isNotNull(apiKeys.policyId),
          ),
        );

      const total = totalResult?.count ?? 0;
      const blocked = blockedResult?.count ?? 0;
      const allowed = allowedResult?.count ?? 0;
      const masked = maskedResult?.count ?? 0;
      const warned = warnedResult?.count ?? 0;
      const active = activeKeysResult?.count ?? 0;
      const totalKeys = totalKeysResult?.count ?? 0;
      const withPolicy = keysWithPolicyResult?.count ?? 0;

      // All-time total (no date filter) — used by the frontend to distinguish
      // "genuinely new account" (allTimeTotal=0) from "quiet time window"
      const [allTimeResult] = await ctx.db
        .select({ count: count() })
        .from(auditEvents)
        .where(scopedCondition);

      return {
        totalRequests: total,
        blockedCount: blocked,
        allowedCount: allowed,
        maskedCount: masked,
        warnedCount: warned,
        threatRate: total > 0 ? ((blocked / total) * 100).toFixed(1) : "0.0",
        activeKeys: active,
        totalKeys,
        policyCoverage:
          active > 0 ? Math.round((withPolicy / active) * 100) : 100,
        keysWithoutPolicy: active - withPolicy,
        allTimeTotal: allTimeResult?.count ?? 0,
      };
    }),

  recentBlocks: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const from = input.dateFrom ? new Date(input.dateFrom) : undefined;
      const to = input.dateTo ? new Date(input.dateTo) : undefined;
      const userId = ctx.session.user.id;
      const includeUnkeyed =
        env.NODE_ENV === "development" ||
        isConfigAdmin(ctx.session, env.CONFIG_ADMIN_EMAILS);
      const scopedCondition = scopedAuditCondition(userId, includeUnkeyed);

      const conditions = [eq(auditEvents.action, "blocked"), scopedCondition];
      if (from) conditions.push(gte(auditEvents.timestamp, from));
      if (to) conditions.push(lte(auditEvents.timestamp, to));

      return ctx.db
        .select()
        .from(auditEvents)
        .where(and(...conditions))
        .orderBy(desc(auditEvents.timestamp))
        .limit(10);
    }),

  entityBreakdown: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 7);
      const from = input.dateFrom ? new Date(input.dateFrom) : defaultFrom;
      const to = input.dateTo ? new Date(input.dateTo) : undefined;
      const userId = ctx.session.user.id;
      const includeUnkeyed =
        env.NODE_ENV === "development" ||
        isConfigAdmin(ctx.session, env.CONFIG_ADMIN_EMAILS);
      const scopedCondition = scopedAuditCondition(userId, includeUnkeyed);

      const whereClause = to
        ? and(
            gte(auditEvents.timestamp, from),
            lte(auditEvents.timestamp, to),
            scopedCondition,
          )
        : and(gte(auditEvents.timestamp, from), scopedCondition);

      const events = await ctx.db
        .select({ entityTypes: auditEvents.entityTypes })
        .from(auditEvents)
        .where(whereClause);

      const counts: Record<string, number> = {};
      for (const event of events) {
        for (const entity of event.entityTypes ?? []) {
          counts[entity] = (counts[entity] ?? 0) + 1;
        }
      }

      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([entity, count]) => ({ entity, count }));
    }),

  engineStatus: protectedProcedure.query(async () => {
    const start = Date.now();
    try {
      const res = await fetch(`${env.ENGINE_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return { online: res.ok, latencyMs: Date.now() - start };
    } catch {
      return { online: false, latencyMs: null };
    }
  }),

  proxyStatus: protectedProcedure.query(async () => {
    const start = Date.now();
    try {
      const res = await fetch(`${env.PROXY_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return { online: res.ok, latencyMs: Date.now() - start };
    } catch {
      return { online: false, latencyMs: null };
    }
  }),
});
