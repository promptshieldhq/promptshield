import { createFileRoute, redirect } from "@tanstack/react-router";

import { getUser } from "@/functions/get-user";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    try {
      const session = await getUser();
      throw redirect({ to: session ? "/dashboard" : "/login" });
    } catch (err: unknown) {
      // Let actual redirects pass through
      if (
        err &&
        typeof err === "object" &&
        ("isRedirect" in err || "_isRedirect" in err)
      )
        throw err;
      // Server unreachable / auth error → go to login
      throw redirect({ to: "/login" });
    }
  },
  component: () => null,
});
