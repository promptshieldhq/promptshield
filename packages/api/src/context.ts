import { auth } from "@promptshield/auth";
import { db } from "@promptshield/db";
import type { Database } from "@promptshield/db";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export interface Context extends Record<string, unknown> {
  session: Session;
  db: Database;
}

export async function createContext({
  context,
}: CreateContextOptions): Promise<Context> {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    session,
    db,
  };
}
