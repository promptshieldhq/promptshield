import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);

  if (isPending) {
    return (
      <div className="h-9 w-full animate-pulse rounded bg-[var(--dev-panel)]" />
    );
  }

  if (!session) {
    return (
      <Link
        to="/login"
        className="mono flex w-full items-center justify-center rounded border border-[var(--dev-border)] px-3 py-1.5 text-[12px] text-[var(--dev-text)] transition-colors hover:bg-[var(--dev-panel)]"
      >
        sign in →
      </Link>
    );
  }

  const initial = (session.user.name || session.user.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded px-2 py-2 text-left transition-colors hover:bg-[var(--dev-panel)]"
      >
        <div
          className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-semibold"
          style={{
            backgroundColor: "rgba(122,162,255,0.10)",
            color: "var(--dev-accent-hi)",
            border: "1px solid rgba(122,162,255,0.20)",
          }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mono truncate text-[12px] text-[var(--dev-text)]">
            {session.user.name}
          </p>
          <p className="mono truncate text-[10px] text-[var(--dev-text-mute)]">
            {session.user.email}
          </p>
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 z-20 mb-1 overflow-hidden rounded border border-[var(--dev-border)] bg-[var(--dev-panel-hi)] shadow-lg">
            <button
              onClick={() => {
                setOpen(false);
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => navigate({ to: "/login" }),
                  },
                });
              }}
              className="mono flex w-full items-center gap-2.5 px-3 py-2.5 text-[12px] text-[var(--dev-red,#F07A7A)] transition-colors hover:bg-[rgba(240,122,122,0.08)]"
            >
              <LogOut size={12} />
              sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
