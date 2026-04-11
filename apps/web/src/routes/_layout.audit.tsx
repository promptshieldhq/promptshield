import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_layout/audit")({
  component: AuditPage,
});

/* Helpers */
type Severity = "CRITICAL" | "WARNING" | "LOW";

function getSeverity(action: string, entityCount: number): Severity {
  if (action === "blocked" && entityCount >= 2) return "CRITICAL";
  if (action === "blocked") return "WARNING";
  return "LOW";
}

const SEVERITY_STYLE: Record<
  Severity,
  { dot: string; badge: string; label: string }
> = {
  CRITICAL: {
    dot: "bg-destructive",
    badge: "text-destructive",
    label: "Critical",
  },
  WARNING: { dot: "bg-warning", badge: "text-warning", label: "Warning" },
  LOW: { dot: "bg-success", badge: "text-success", label: "Low" },
};

const ACTION_STYLE: Record<string, string> = {
  blocked: "border-destructive/20 bg-destructive/10 text-destructive",
  masked: "border-warning/20 bg-warning/10 text-warning",
  allowed: "border-success/20 bg-success/10 text-success",
};

function fmtTs(ts: Date | string) {
  const d = new Date(ts);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 8);
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${date} ${time}.${ms}`;
}

type ActionFilter = "all" | "blocked" | "masked" | "allowed" | "warned";
type TimeFilter = "24h" | "7d" | "all";

/* Page */
function AuditPage() {
  const trpc = useTRPC();

  const [page, setPage] = useState(1);
  const [action, setAction] = useState<ActionFilter>("all");
  const [keySearch, setKeySearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("24h");
  const [entityFilter, setEntityFilter] = useState("all");

  // Keep dateFrom stable to avoid refetch loops.
  const dateFrom = useMemo(() => {
    if (timeFilter === "all") return undefined;
    const base = new Date();
    base.setMilliseconds(0);
    if (timeFilter === "24h") {
      return new Date(base.getTime() - 86_400_000).toISOString();
    }
    return new Date(base.getTime() - 7 * 86_400_000).toISOString();
  }, [timeFilter]);

  const events = useQuery(
    trpc.audit.list.queryOptions({
      page,
      action,
      keyId: keySearch.trim() || undefined,
      entityType: entityFilter !== "all" ? entityFilter : undefined,
      dateFrom,
    }),
  );

  function exportJson() {
    const json = JSON.stringify(events.data ?? [], null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ACTION_TABS: { value: ActionFilter; label: string }[] = [
    { value: "all", label: "All Actions" },
    { value: "blocked", label: "Blocked" },
    { value: "masked", label: "Masked" },
  ];

  const rows = events.data ?? [];

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      
      <header className="sticky top-0 z-10 flex h-[52px] items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-semibold text-foreground">Audit Log</h1>
          {!events.isLoading && (
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {rows.length > 0
                ? `${rows.length}${rows.length === 50 ? "+" : ""} events`
                : "0 events"}
            </span>
          )}
        </div>
        <button
          onClick={exportJson}
          disabled={rows.length === 0}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={12} aria-hidden="true" />
          Export JSON
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/10 px-6 py-3">
        {/* Key ID search */}
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Filter by Key ID..."
            value={keySearch}
            onChange={(e) => {
              setKeySearch(e.target.value);
              setPage(1);
            }}
            className="h-7 rounded-md border border-border bg-background pl-7 pr-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Action tabs */}
        <div className="flex items-center rounded-md border border-border bg-background p-0.5">
          {ACTION_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setAction(tab.value);
                setPage(1);
              }}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                action === tab.value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Time filter */}
        <div className="flex items-center rounded-md border border-border bg-background p-0.5">
          {(["24h", "7d", "all"] as TimeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTimeFilter(t);
                setPage(1);
              }}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                timeFilter === t
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "24h"
                ? "Last 24 hours"
                : t === "7d"
                  ? "Last 7 days"
                  : "All time"}
            </button>
          ))}
        </div>

        {/* Entity filter */}
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="h-7 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Entity: All</option>
          <option value="EMAIL_ADDRESS">EMAIL_ADDRESS</option>
          <option value="PHONE_NUMBER">PHONE_NUMBER</option>
          <option value="CREDIT_CARD">CREDIT_CARD</option>
          <option value="US_SSN">US_SSN</option>
          <option value="AWS_ACCESS_KEY">AWS_ACCESS_KEY</option>
          <option value="GITHUB_TOKEN">GITHUB_TOKEN</option>
          <option value="PERSON">PERSON</option>
          <option value="IP_ADDRESS">IP_ADDRESS</option>
          <option value="API_KEY">API_KEY</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table
          className="w-full min-w-[600px]"
          role="table"
          aria-label="Audit log events"
        >
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {[
                "Timestamp",
                "Severity",
                "Key Identifier",
                "Action",
                "Entity Types",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Loading */}
            {events.isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div
                        className="h-2.5 animate-pulse rounded bg-muted/50"
                        style={{ width: `${55 + ((j * 13) % 45)}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))}

            {/* Empty */}
            {!events.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No events found
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try adjusting your filters or send traffic through the
                    proxy.
                  </p>
                </td>
              </tr>
            )}

            {/* Rows */}
            {!events.isLoading &&
              rows.map((event) => {
                const sev = getSeverity(
                  event.action,
                  event.entityTypes?.length ?? 0,
                );
                const sevS = SEVERITY_STYLE[sev];
                return (
                  <tr
                    key={event.id}
                    className="border-b border-border/60 transition-colors duration-75 hover:bg-muted/10"
                  >
                    {/* Timestamp */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {fmtTs(event.timestamp)}
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3">
                      <span
                        className={`flex items-center gap-1.5 text-[11px] font-semibold ${sevS.badge}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${sevS.dot}`}
                          aria-hidden="true"
                        />
                        {sevS.label.toUpperCase()}
                      </span>
                    </td>

                    {/* Key */}
                    <td
                      className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-foreground"
                      title={event.keyId ?? "—"}
                    >
                      {event.keyId ?? (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${ACTION_STYLE[event.action] ?? "border-border bg-muted text-muted-foreground"}`}
                      >
                        {event.action}
                      </span>
                    </td>

                    {/* Entity types */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(event.entityTypes ?? []).slice(0, 3).map((e) => (
                          <span
                            key={e}
                            className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {e}
                          </span>
                        ))}
                        {(event.entityTypes?.length ?? 0) > 3 && (
                          <span className="text-[10px] text-muted-foreground/50">
                            +{(event.entityTypes?.length ?? 0) - 3}
                          </span>
                        )}
                        {(event.entityTypes?.length ?? 0) === 0 && (
                          <span className="text-[11px] text-muted-foreground/40">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border px-6 py-3">
        <p className="text-[11px] text-muted-foreground">
          {events.isLoading
            ? "Loading…"
            : `Showing ${Math.min((page - 1) * 50 + 1, rows.length > 0 ? (page - 1) * 50 + rows.length : 0)}–${(page - 1) * 50 + rows.length} results`}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || events.isLoading}
            aria-label="Previous page"
            className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={13} aria-hidden="true" />
          </button>
          <span className="min-w-[2rem] text-center text-[11px] font-medium text-foreground">
            {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={rows.length < 50 || events.isLoading}
            aria-label="Next page"
            className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
