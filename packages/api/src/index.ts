import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

const trpc = initTRPC.context<Context>().create();

export const t: typeof trpc = trpc;

export const router: typeof trpc.router = trpc.router;

export const publicProcedure: typeof trpc.procedure = trpc.procedure;

export const protectedProcedure = trpc.procedure.use<{
  session: NonNullable<Context["session"]>;
}>(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
