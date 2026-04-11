import { apiKeys } from "@promptshield/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";

import { protectedProcedure, router } from "../index";

export const keysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        policyId: apiKeys.policyId,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.session.user.id))
      .orderBy(desc(apiKeys.createdAt));

    return keys;
  }),

  create: protectedProcedure
    .input(
      z.object({ name: z.string().min(1), policyId: z.string().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      const rawKey = `ps_live_${randomBytes(24).toString("hex")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.slice(0, 15);

      const [created] = await ctx.db
        .insert(apiKeys)
        .values({
          name: input.name,
          keyHash,
          keyPrefix,
          userId: ctx.session.user.id,
          policyId: input.policyId ?? null,
        })
        .returning();

      return { ...created, rawKey };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiKeys.id, input.id),
            eq(apiKeys.userId, ctx.session.user.id),
          ),
        );
    }),

  assignPolicy: protectedProcedure
    .input(z.object({ id: z.string(), policyId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(apiKeys)
        .set({ policyId: input.policyId })
        .where(
          and(
            eq(apiKeys.id, input.id),
            eq(apiKeys.userId, ctx.session.user.id),
          ),
        );
    }),
});
