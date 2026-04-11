import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);

  if (isPending) {
    return <div className="h-9 w-full animate-pulse rounded-lg bg-border" />;
  }

  if (!session) {
    return (
      <Link
        to="/login"
        className="flex w-full items-center justify-center rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-background transition-colors"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-background transition-colors"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {session.user.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {session.user.email}
          </p>
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 z-20 mb-1 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
            <button
              onClick={() => {
                setOpen(false);
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => navigate({ to: "/login" }),
                  },
                });
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
