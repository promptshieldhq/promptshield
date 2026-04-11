import { apiKeys, auditEvents, eventAggByDay } from "@promptshield/db";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "@promptshield/env/server";

import { protectedProcedure, router } from "../index";
import { isConfigAdmin } from "../admin-auth";

export const auditRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        action: z
          .enum(["all", "allowed", "blocked", "masked", "warned"])
          .default("all"),
        keyId: z.string().optional(),
        entityType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const adminCanViewUnkeyed = isConfigAdmin(
        ctx.session,
        env.CONFIG_ADMIN_EMAILS,
      );
      const includeUnkeyed = env.NODE_ENV === "development" || adminCanViewUnkeyed;
      const conditions = [];

      const ownedCondition = sql`
        exists (
          select 1
          from ${apiKeys}
          where ${apiKeys.id} = ${auditEvents.keyId}
            and ${apiKeys.userId} = ${userId}
        )
      `;

      conditions.push(
        includeUnkeyed
          ? or(ownedCondition, isNull(auditEvents.keyId))
          : ownedCondition,
      );

      if (input.action !== "all") {
        conditions.push(eq(auditEvents.action, input.action));
      }
      if (input.keyId) {
        conditions.push(eq(auditEvents.keyId, input.keyId));
      }
      if (input.entityType) {
        conditions.push(
          sql`${input.entityType} = ANY(${auditEvents.entityTypes})`,
        );
      }
      if (input.dateFrom) {
        conditions.push(gte(auditEvents.timestamp, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        conditions.push(lte(auditEvents.timestamp, new Date(input.dateTo)));
      }

      // Free tier: 7-day retention
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      conditions.push(gte(auditEvents.timestamp, sevenDaysAgo));

      const offset = (input.page - 1) * 50;

      const events = await ctx.db
        .select()
        .from(auditEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditEvents.timestamp))
        .limit(50)
        .offset(offset);

      return events;
    }),

  trend: protectedProcedure.query(async ({ ctx }) => {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const userId = ctx.session.user.id;

    const rows = await ctx.db
      .select()
      .from(eventAggByDay)
      .where(
        and(
          gte(sql`${eventAggByDay.date}::date`, fourteenDaysAgo),
          sql`
          exists (
            select 1
            from ${apiKeys}
            where ${apiKeys.id} = ${eventAggByDay.keyId}
              and ${apiKeys.userId} = ${userId}
          )
        `,
        ),
      )
      .orderBy(eventAggByDay.date);

    return rows;
  }),
});
