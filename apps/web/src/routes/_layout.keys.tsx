import { createFileRoute } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/_layout/keys")({
  component: KeysPage,
});

function KeysPage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded border border-[var(--dev-border)] bg-[var(--dev-panel)]">
          <KeyRound size={20} className="text-[var(--dev-accent)]" />
        </div>
        <div>
          <h1 className="mono text-[10px] uppercase tracking-widest text-[var(--dev-text-mute)]">
            # api/keys
          </h1>
          <p className="mt-2 text-xl font-bold text-[var(--dev-text)]">
            API Keys
          </p>
          <p className="mt-1.5 text-[12px] text-[var(--dev-text-dim)]">
            Create and manage API keys to authenticate gateway requests, assign
            per-key policies, and track usage.
          </p>
        </div>
        <span
          className="mono inline-flex items-center gap-1.5 rounded px-3 py-1 text-[11px] uppercase tracking-widest"
          style={{
            backgroundColor: "rgba(122,162,255,0.10)",
            color: "var(--dev-accent-hi)",
            border: "1px solid rgba(122,162,255,0.20)",
          }}
        >
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ backgroundColor: "var(--dev-accent)" }}
          />
          coming soon
        </span>
      </div>
    </div>
  );
}
