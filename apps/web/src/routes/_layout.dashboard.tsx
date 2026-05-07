import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { env } from "@promptshield/env/web";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  RefreshCw,
  ShieldOff,
  Terminal,
} from "lucide-react";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_layout/dashboard")({
  component: DashboardPage,
});

/* Helpers  */
function Sk({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted/50 ${className}`}
      aria-hidden="true"
    />
  );
}

function relTime(date: Date | string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── Stat tile ────────────────────────────────────────────────────── */
const ACCENT_VALUE: Record<string, string> = {
  danger: "text-[var(--dev-red,#F07A7A)]",
  warning: "text-[var(--dev-amber)]",
  success: "text-[var(--dev-green)]",
  default: "text-[var(--dev-text)]",
};
const ACCENT_BAR: Record<string, string> = {
  danger: "bg-[var(--dev-red,#F07A7A)]",
  warning: "bg-[var(--dev-amber)]",
  success: "bg-[var(--dev-green)]",
  default: "bg-[var(--dev-accent)]",
};

function Stat({
  label,
  value,
  sub,
  note,
  accent = "default",
  loading,
  barPct,
}: {
  label: string;
  value?: string | number;
  sub?: string;
  note?: string;
  accent?: "danger" | "warning" | "success" | "default";
  loading?: boolean;
  barPct?: number;
}) {
  return (
    <div className="rounded border border-[var(--dev-border)] bg-[var(--dev-panel)] px-5 py-4">
      {loading ? (
        <div className="space-y-2.5">
          <Sk className="h-2 w-20" />
          <Sk className="h-9 w-16" />
          <Sk className="h-1 w-full rounded-full" />
          <Sk className="h-2 w-28" />
        </div>
      ) : (
        <>
          <p className="mono text-[10px] uppercase tracking-widest text-[var(--dev-text-mute)]">
            # {label.toLowerCase()}
          </p>
          <p
            className={`mono mt-2 text-[2rem] font-semibold leading-none tabular-nums tracking-tight ${ACCENT_VALUE[accent]}`}
          >
            {value ?? "—"}
          </p>
          {barPct !== undefined && (
            <div className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-[var(--dev-border)]">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ease-out ${ACCENT_BAR[accent]}`}
                style={{ width: `${Math.min(barPct, 100)}%` }}
                role="presentation"
              />
            </div>
          )}
          <div
            className={`flex items-baseline justify-between gap-2 ${barPct !== undefined ? "mt-1.5" : "mt-2"}`}
          >
            {sub && (
              <p className="text-[11px] text-[var(--dev-text-dim)]">{sub}</p>
            )}
            {note && (
              <p className="mono shrink-0 text-[10px] tabular-nums text-[var(--dev-text-mute)]">
                {note}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* Service status pill */
function StatusPill({
  label,
  online,
  latencyMs,
  loading,
}: {
  label: string;
  online?: boolean;
  latencyMs?: number | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded border border-[var(--dev-border)] bg-[var(--dev-panel)] px-3 py-2">
        <Sk className="h-1.5 w-1.5 rounded-full" />
        <Sk className="h-2.5 w-24" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded border border-[var(--dev-border)] bg-[var(--dev-panel)] px-3 py-2">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          online == null
            ? "bg-[var(--dev-text-mute)]/40"
            : online
              ? "bg-[var(--dev-green)]"
              : "bg-[var(--dev-red,#F07A7A)]"
        }`}
        aria-hidden="true"
      />
      <span className="mono text-[12px] font-medium text-[var(--dev-text)]">
        {label.toLowerCase()}
      </span>
      {online == null ? (
        <span className="mono text-[10px] text-[var(--dev-text-mute)]">—</span>
      ) : online ? (
        <span className="mono text-[10px] tabular-nums text-[var(--dev-text-dim)]">
          {latencyMs != null ? `${latencyMs}ms` : "online"}
        </span>
      ) : (
        <span className="mono text-[10px] font-medium text-[var(--dev-red,#F07A7A)]">
          offline
        </span>
      )}
    </div>
  );
}

/* Entity bar colors */
const BAR_COLOR = [
  "bg-[var(--dev-red,#F07A7A)]",
  "bg-[var(--dev-amber)]",
  "bg-[var(--dev-amber)]/60",
  "bg-[var(--dev-accent)]/40",
  "bg-[var(--dev-text-mute)]/30",
] as const;

/* Time range */
type Range = "1h" | "6h" | "24h" | "7d" | "30d";

const RANGES: { value: Range; label: string; note: string; ms: number }[] = [
  { value: "1h", label: "1h", note: "last 1 hour", ms: 3_600_000 },
  { value: "6h", label: "6h", note: "last 6 hours", ms: 6 * 3_600_000 },
  { value: "24h", label: "24h", note: "last 24 hours", ms: 86_400_000 },
  { value: "7d", label: "7d", note: "last 7 days", ms: 7 * 86_400_000 },
  { value: "30d", label: "30d", note: "last 30 days", ms: 30 * 86_400_000 },
];

/* Page */
function DashboardPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<Range>("24h");

  // Real-time push: subscribe to the audit stream, invalidate dashboard queries on each tick.
  // EventSource auto-reconnects on drop. Falls back to polling intervals if the stream errors.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${env.VITE_SERVER_URL}/internal/audit/stream`;
    const es = new EventSource(url, { withCredentials: true });
    // Refresh whatever is currently mounted; react-query only refetches active subscriptions.
    const onAudit = () => queryClient.invalidateQueries();
    es.addEventListener("audit", onAudit);
    return () => {
      es.removeEventListener("audit", onAudit);
      es.close();
    };
  }, [queryClient]);

  const rangeConfig = RANGES.find((r) => r.value === range)!;
  const dateFrom = useMemo(
    () => new Date(Date.now() - rangeConfig.ms).toISOString(),
    [rangeConfig.ms],
  );
  const noteLabel = rangeConfig.note;

  const stats = useQuery(
    trpc.dashboard.stats.queryOptions(
      { dateFrom },
      { refetchInterval: 30_000 },
    ),
  );
  const recentBlocks = useQuery(
    trpc.dashboard.recentBlocks.queryOptions(
      { dateFrom },
      { refetchInterval: 15_000 },
    ),
  );
  const breakdown = useQuery(
    trpc.dashboard.entityBreakdown.queryOptions(
      { dateFrom },
      { refetchInterval: 60_000 },
    ),
  );
  const gatewayStatus = useQuery(
    trpc.dashboard.gatewayStatus.queryOptions(undefined, {
      refetchInterval: 30_000,
    }),
  );
  const engineStatus = useQuery(
    trpc.dashboard.engineStatus.queryOptions(undefined, {
      refetchInterval: 30_000,
    }),
  );

  const statsReady = stats.status === "success" || stats.status === "error";
  const isEmpty = statsReady && (stats.data?.allTimeTotal ?? 0) === 0;
  const s = stats.data;

  const blocks = recentBlocks.data ?? [];
  const entityData = breakdown.data ?? [];

  const threatRate =
    s && s.totalRequests > 0 ? parseFloat(String(s.threatRate)) : null;
  const isRefreshing =
    stats.isFetching || recentBlocks.isFetching || gatewayStatus.isFetching;

  const threatAccent =
    threatRate == null
      ? "default"
      : threatRate === 0
        ? "success"
        : threatRate < 10
          ? "warning"
          : "danger";

  const maxEntityCount = Math.max(...entityData.map((d) => d.count), 1);

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-[52px] items-center justify-between border-b border-[var(--dev-border)] bg-[var(--dev-bg)]/95 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="mono text-[10px] uppercase tracking-widest text-[var(--dev-text-mute)]">
            ~/
          </span>
          <h1 className="mono text-[13px] font-semibold text-[var(--dev-text)]">
            dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-[var(--dev-border)] bg-[var(--dev-panel)] p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`mono rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  range === r.value
                    ? "bg-[rgba(122,162,255,0.10)] text-[var(--dev-text)] border border-[rgba(122,162,255,0.25)]"
                    : "border border-transparent text-[var(--dev-text-mute)] hover:text-[var(--dev-text)]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              stats.refetch();
              recentBlocks.refetch();
              breakdown.refetch();
              gatewayStatus.refetch();
              engineStatus.refetch();
            }}
            aria-label="Refresh dashboard"
            disabled={isRefreshing}
            className="flex h-8 w-8 items-center justify-center rounded border border-[var(--dev-border)] text-[var(--dev-text-dim)] transition-colors hover:bg-[var(--dev-panel)] hover:text-[var(--dev-text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
              className={isRefreshing ? "motion-safe:animate-spin" : ""}
            />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 p-6">
        {/* Service status */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label="Gateway"
            online={gatewayStatus.data?.online}
            latencyMs={gatewayStatus.data?.latencyMs}
            loading={gatewayStatus.isPending}
          />
          <StatusPill
            label="Engine"
            online={engineStatus.data?.online}
            latencyMs={engineStatus.data?.latencyMs}
            loading={engineStatus.isPending}
          />
          {gatewayStatus.data?.online === false && (
            <span className="text-[11px] text-muted-foreground">
              Gateway is offline
            </span>
          )}
          {engineStatus.data?.online === false &&
            gatewayStatus.data?.online !== false && (
              <span className="text-[11px] text-muted-foreground">
                Engine is offline
              </span>
            )}
        </div>

        {/* Stat tiles  */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat
            label="Total Requests"
            value={s?.totalRequests?.toLocaleString() ?? (isEmpty ? "—" : "0")}
            sub={
              s && s.totalRequests > 0
                ? `${(s.totalRequests - s.blockedCount).toLocaleString()} processed`
                : "No traffic in range"
            }
            note={noteLabel}
            accent="default"
            loading={stats.status === "pending"}
          />
          <Stat
            label="Threat Rate"
            value={
              threatRate != null
                ? `${threatRate.toFixed(1)}%`
                : isEmpty
                  ? "—"
                  : "0.0%"
            }
            barPct={threatRate ?? 0}
            sub={
              s && s.totalRequests > 0
                ? `${s.blockedCount.toLocaleString()} blocked of ${s.totalRequests.toLocaleString()}`
                : "No traffic yet"
            }
            note={noteLabel}
            accent={
              threatAccent as "danger" | "warning" | "success" | "default"
            }
            loading={stats.status === "pending"}
          />
          <Stat
            label="Blocked"
            value={s?.blockedCount?.toLocaleString() ?? (isEmpty ? "—" : "0")}
            sub={
              s && s.totalRequests > 0
                ? `1 in ${Math.round(s.totalRequests / Math.max(s.blockedCount, 1))} calls`
                : "No traffic in range"
            }
            note={noteLabel}
            accent="danger"
            loading={stats.status === "pending"}
          />
          <Stat
            label="Allowed"
            value={s?.allowedCount?.toLocaleString() ?? (isEmpty ? "—" : "0")}
            sub={
              s && s.totalRequests > 0
                ? `${((s.allowedCount / s.totalRequests) * 100).toFixed(1)}% of traffic`
                : "No traffic in range"
            }
            note={noteLabel}
            accent="success"
            loading={stats.status === "pending"}
          />
          <Stat
            label="Masked"
            value={s?.maskedCount?.toLocaleString() ?? (isEmpty ? "—" : "0")}
            sub={
              s && s.totalRequests > 0
                ? `${((s.maskedCount / s.totalRequests) * 100).toFixed(1)}% of traffic`
                : "No traffic in range"
            }
            note={noteLabel}
            accent="warning"
            loading={stats.status === "pending"}
          />
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded border border-[var(--dev-border)] bg-[var(--dev-panel)] px-6 py-8">
            <div className="mx-auto max-w-lg">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded border border-[var(--dev-border)] bg-[var(--dev-panel-hi)]">
                <Terminal
                  size={18}
                  className="text-[var(--dev-accent)]"
                  aria-hidden="true"
                />
              </div>
              <h2 className="mono text-[13px] font-semibold text-[var(--dev-text)]">
                no requests proxied yet
              </h2>
              <p className="mt-1 text-[13px] text-[var(--dev-text-dim)]">
                Point your application at the gateway instead of calling the LLM
                directly. Stats will appear here as traffic flows through.
              </p>

              <div className="mt-4 space-y-3">
                <p className="mono text-[10px] uppercase tracking-widest text-[var(--dev-text-mute)]">
                  # quick-test
                </p>
                <pre className="mono overflow-x-auto rounded border border-[var(--dev-border)] bg-[var(--dev-panel-hi)] p-3 text-[11px] leading-relaxed text-[var(--dev-text)]">
                  <span style={{ color: "var(--dev-accent)" }}>$</span>{" "}
                  {`curl http://localhost:8080/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{
      "role": "user",
      "content": "My email is john@example.com"
    }]
  }'`}
                </pre>
                <p className="text-[11px] text-[var(--dev-text-dim)]">
                  The gateway will detect{" "}
                  <code className="mono rounded bg-[var(--dev-panel-hi)] border border-[var(--dev-border)] px-1 text-[10px] text-[var(--dev-accent-hi)]">
                    EMAIL_ADDRESS
                  </code>{" "}
                  and apply your policy action.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  to="/policy"
                  className="mono flex items-center gap-1.5 rounded border border-[var(--dev-border)] bg-[var(--dev-bg)] px-3 py-2 text-[12px] text-[var(--dev-text)] transition-colors hover:bg-[var(--dev-panel-hi)]"
                >
                  <ShieldOff size={12} aria-hidden="true" />
                  edit policy →
                </Link>
                <Link
                  to="/audit"
                  className="mono flex items-center gap-1.5 rounded border border-[var(--dev-border)] bg-[var(--dev-bg)] px-3 py-2 text-[12px] text-[var(--dev-text)] transition-colors hover:bg-[var(--dev-panel-hi)]"
                >
                  <Cpu size={12} aria-hidden="true" />
                  audit log →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main content (recent blocks + entity distribution) */}
        {!isEmpty && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Recent blocks — 3 cols */}
            <section
              className="overflow-hidden rounded border border-[var(--dev-border)] bg-[var(--dev-panel)] lg:col-span-3"
              aria-label="Recent blocked requests"
            >
              <div className="flex h-10 items-center justify-between border-b border-[var(--dev-border)] px-4">
                <div className="flex items-center gap-2">
                  <ShieldOff
                    size={12}
                    className="text-[var(--dev-text-mute)]"
                    aria-hidden="true"
                  />
                  <h2 className="mono text-[11px] uppercase tracking-widest text-[var(--dev-text-dim)]">
                    # recent-blocks
                  </h2>
                  {blocks.length > 0 && (
                    <span className="mono rounded border border-[var(--dev-red,#F07A7A)]/30 bg-[var(--dev-red,#F07A7A)]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--dev-red,#F07A7A)]">
                      {blocks.length}
                    </span>
                  )}
                </div>
                <Link
                  to="/audit"
                  className="mono flex items-center gap-1 text-[11px] text-[var(--dev-text-mute)] transition-colors hover:text-[var(--dev-text)]"
                >
                  audit log <ArrowRight size={10} aria-hidden="true" />
                </Link>
              </div>

              {recentBlocks.isPending && (
                <div className="divide-y divide-border/60">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                      <Sk className="h-2.5 w-14 shrink-0" />
                      <Sk className="h-2.5 w-24 shrink-0" />
                      <Sk className="h-4 flex-1 max-w-[160px] rounded" />
                      <Sk className="h-2.5 w-10 ml-auto shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              {!recentBlocks.isPending && blocks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--dev-green)]/10">
                    <CheckCircle2
                      size={18}
                      className="text-[var(--dev-green)]"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mono text-[13px] font-medium text-[var(--dev-text)]">
                    no blocks in this window
                  </p>
                  <p className="mt-1 max-w-xs text-[11px] text-[var(--dev-text-dim)]">
                    All calls forwarded clean. Try a wider time range or send a
                    test request with PII.
                  </p>
                </div>
              )}

              {!recentBlocks.isPending && blocks.length > 0 && (
                <table className="w-full" role="table">
                  <thead>
                    <tr className="border-b border-[var(--dev-border)] bg-[var(--dev-panel-hi)]/40">
                      {["time", "key", "entities"].map((h) => (
                        <th
                          key={h}
                          className="mono px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-[var(--dev-text-mute)]"
                        >
                          # {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--dev-border)]/60">
                    {blocks.map((event) => (
                      <tr
                        key={event.id}
                        className="group transition-colors duration-75 hover:bg-[var(--dev-panel-hi)]/40"
                      >
                        <td className="mono whitespace-nowrap px-4 py-3 text-[11px] tabular-nums text-[var(--dev-text-mute)]">
                          {relTime(event.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="mono inline-flex max-w-[110px] truncate rounded bg-[var(--dev-panel-hi)] border border-[var(--dev-border)] px-2 py-0.5 text-[11px] text-[var(--dev-text)]"
                            title={event.keyId ?? "anonymous"}
                          >
                            {event.keyId ?? (
                              <span className="text-[var(--dev-text-mute)]">
                                anon
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {(event.entityTypes ?? []).slice(0, 2).map((e) => (
                              <span
                                key={e}
                                title={e}
                                className="mono rounded border border-[var(--dev-red,#F07A7A)]/25 bg-[var(--dev-red,#F07A7A)]/10 px-1.5 py-0.5 text-[10px] text-[var(--dev-red,#F07A7A)]"
                              >
                                {e}
                              </span>
                            ))}
                            {(event.entityTypes?.length ?? 0) > 2 && (
                              <span className="mono text-[10px] text-[var(--dev-text-mute)]">
                                +{(event.entityTypes?.length ?? 0) - 2}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Entity distribution — 2 cols */}
            <section
              className="overflow-hidden rounded border border-[var(--dev-border)] bg-[var(--dev-panel)] lg:col-span-2"
              aria-label="Entity distribution"
            >
              <div className="flex h-10 items-center justify-between border-b border-[var(--dev-border)] px-4">
                <div className="flex items-center gap-2">
                  <Cpu
                    size={12}
                    className="text-[var(--dev-text-mute)]"
                    aria-hidden="true"
                  />
                  <h2 className="mono text-[11px] uppercase tracking-widest text-[var(--dev-text-dim)]">
                    # entities
                  </h2>
                </div>
                <span className="mono text-[10px] text-[var(--dev-text-mute)]">
                  {noteLabel}
                </span>
              </div>

              <div className="px-4 py-3">
                {breakdown.isPending ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between">
                          <Sk className="h-2.5 w-28" />
                          <Sk className="h-2.5 w-8" />
                        </div>
                        <Sk className="h-1.5 w-full" />
                      </div>
                    ))}
                  </div>
                ) : entityData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="mono text-[11px] text-[var(--dev-text-mute)]">
                      no entity data in this range
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--dev-border)]/40">
                    {entityData.map((item, idx) => (
                      <div
                        key={item.entity}
                        className="py-2 first:pt-0 last:pb-0"
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span
                            className="mono min-w-0 flex-1 truncate text-[11px] text-[var(--dev-text)]"
                            title={item.entity}
                          >
                            {item.entity}
                          </span>
                          <span className="mono shrink-0 text-[11px] tabular-nums text-[var(--dev-text-dim)]">
                            {item.count.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-[var(--dev-border)]">
                          <div
                            className={`h-full rounded-sm transition-[width] duration-700 ease-out motion-reduce:transition-none ${BAR_COLOR[idx] ?? "bg-[var(--dev-text-mute)]/20"}`}
                            style={{
                              width: `${(item.count / maxEntityCount) * 100}%`,
                            }}
                            role="presentation"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
