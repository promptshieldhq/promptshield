import { publicProcedure, router } from "../index";
import { auditRouter } from "./audit";
import { dashboardRouter } from "./dashboard";
import { keysRouter } from "./keys";
import { policiesRouter } from "./policies";
import { proxyRouter } from "./proxy";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  dashboard: dashboardRouter,
  proxy: proxyRouter,
  keys: keysRouter,
  audit: auditRouter,
  policies: policiesRouter,
});

export type AppRouter = typeof appRouter;
