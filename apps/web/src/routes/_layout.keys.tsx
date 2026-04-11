import { createFileRoute } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/_layout/keys")({
  component: KeysPage,
});

function KeysPage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex items-center justify-center mx-auto h-14 w-14 rounded-2xl bg-secondary border border-border">
          <KeyRound size={22} className="text-muted-foreground" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            API Keys
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Create and manage API keys to authenticate proxy requests, assign
            per-key policies, and track usage.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Coming soon
        </span>
      </div>
    </div>
  );
}
