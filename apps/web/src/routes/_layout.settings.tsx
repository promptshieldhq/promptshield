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
      <header className="sticky top-0 z-10 flex h-[52px] items-center gap-3 border-b border-[var(--dev-border)] bg-[var(--dev-bg)]/95 px-6 backdrop-blur-sm">
        <span className="mono text-[10px] uppercase tracking-widest text-[var(--dev-text-mute)]">
          ~/
        </span>
        <h1 className="mono text-[13px] font-semibold text-[var(--dev-text)]">
          settings
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-2xl space-y-5">
          {/* Profile */}
          <section className="overflow-hidden rounded border border-[var(--dev-border)] bg-[var(--dev-panel)]">
            <div className="border-b border-[var(--dev-border)] px-5 py-3">
              <h2 className="mono text-[11px] uppercase tracking-widest text-[var(--dev-text-dim)]">
                # profile
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--dev-text-mute)]">
                Your account information.
              </p>
            </div>
            <div className="divide-y divide-[var(--dev-border)]">
              {[
                {
                  label: "name",
                  value: session?.user.name ?? "—",
                  mono: false,
                },
                {
                  label: "email",
                  value: session?.user.email ?? "—",
                  mono: true,
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <p className="mono text-[11px] uppercase tracking-widest text-[var(--dev-text-mute)]">
                    {f.label}
                  </p>
                  <p
                    className={`text-[12px] text-[var(--dev-text)] ${f.mono ? "mono" : "font-medium"}`}
                  >
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Session */}
          <section className="overflow-hidden rounded border border-[var(--dev-border)] bg-[var(--dev-panel)]">
            <div className="border-b border-[var(--dev-border)] px-5 py-3">
              <h2 className="mono text-[11px] uppercase tracking-widest text-[var(--dev-text-dim)]">
                # session
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--dev-text-mute)]">
                Manage your active session.
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mono text-[12px] font-medium text-[var(--dev-text)]">
                    sign out
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--dev-text-mute)]">
                    You will be redirected to the login page.
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="mono flex items-center gap-2 rounded border border-[var(--dev-red,#F07A7A)]/30 bg-[var(--dev-red,#F07A7A)]/5 px-3 py-2 text-[12px] font-medium text-[var(--dev-red,#F07A7A)] transition-colors hover:bg-[var(--dev-red,#F07A7A)]/10"
                >
                  <LogOut size={12} aria-hidden="true" />
                  sign out
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
