import { publicProcedure, router } from "../index";
import { auditRouter } from "./audit";
import { dashboardRouter } from "./dashboard";
import { gatewayRouter } from "./gateway";
import { keysRouter } from "./keys";
import { policiesRouter } from "./policies";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  dashboard: dashboardRouter,
  gateway: gatewayRouter,
  keys: keysRouter,
  audit: auditRouter,
  policies: policiesRouter,
});

export type AppRouter = typeof appRouter;
