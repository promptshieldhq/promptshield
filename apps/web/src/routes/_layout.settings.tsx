import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { session } = Route.useRouteContext() as {
    session?: { user: { name?: string; email?: string } } | null;
  };

  function handleSignOut() {
    authClient.signOut({
      fetchOptions: { onSuccess: () => navigate({ to: "/login" }) },
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-[52px] items-center border-b border-border bg-background/95 px-6 backdrop-blur-sm">
        <h1 className="text-sm font-semibold text-foreground">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-2xl space-y-5">
          {/* Profile */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-xs font-semibold text-foreground">Profile</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Your account information.
              </p>
            </div>
            <div className="divide-y divide-border">
              {[
                {
                  label: "Name",
                  value: session?.user.name ?? "—",
                  mono: false,
                },
                {
                  label: "Email",
                  value: session?.user.email ?? "—",
                  mono: true,
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <p className="text-xs text-muted-foreground/70">{f.label}</p>
                  <p
                    className={`text-xs text-foreground ${f.mono ? "font-mono" : "font-medium"}`}
                  >
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Session */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-xs font-semibold text-foreground">Session</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Manage your active session.
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Sign out
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    You will be redirected to the login page.
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut size={13} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
