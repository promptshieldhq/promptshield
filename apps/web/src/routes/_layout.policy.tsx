import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_layout/policy")({
  component: PolicyPage,
});

/* Entity definitions  */
const ENTITY_GROUPS: { label: string; color: string; entities: string[] }[] = [
  {
    label: "Financial & Identity",
    color: "text-destructive",
    entities: [
      "CREDIT_CARD",
      "US_SSN",
      "IBAN_CODE",
      "US_BANK_NUMBER",
      "US_ITIN",
      "US_PASSPORT",
      "US_DRIVER_LICENSE",
      "CRYPTO",
      "MEDICAL_LICENSE",
      "NRP",
    ],
  },
  {
    label: "Contact",
    color: "text-warning",
    entities: ["EMAIL_ADDRESS", "PHONE_NUMBER", "IP_ADDRESS", "URL"],
  },
  {
    label: "Credentials & Secrets",
    color: "text-destructive",
    entities: [
      "AWS_ACCESS_KEY",
      "AWS_SECRET_KEY",
      "GITHUB_TOKEN",
      "OPENAI_API_KEY",
      "STRIPE_KEY",
      "SLACK_TOKEN",
      "GOOGLE_API_KEY",
      "BEARER_TOKEN",
      "API_KEY",
      "PRIVATE_KEY",
      "PASSWORD",
    ],
  },
  {
    label: "Identity",
    color: "text-muted-foreground",
    entities: ["PERSON", "ORG", "LOCATION", "DATE_TIME", "AGE"],
  },
];

const ALL_ENTITIES = ENTITY_GROUPS.flatMap((g) => g.entities);

const ACTIONS = ["block", "mask", "allow"] as const;
type Action = (typeof ACTIONS)[number];

const ACTION_PILL_ACTIVE: Record<Action, string> = {
  block: "bg-destructive text-white",
  mask: "bg-warning    text-white",
  allow: "bg-success/20 text-success font-semibold",
};
const ACTION_PILL_IDLE =
  "text-muted-foreground/30 hover:text-muted-foreground/70";

const ACTION_DOT: Record<Action, string> = {
  block: "bg-destructive",
  mask: "bg-warning",
  allow: "bg-success",
};

/* ─── Action pills component ─────────────────────────────────────────── */
function ActionPills({
  value,
  onChange,
  disabled,
}: {
  value: Action;
  onChange: (a: Action) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center rounded border border-border bg-muted/20 p-0.5 gap-px">
      {ACTIONS.map((a) => (
        <button
          key={a}
          onClick={() => !disabled && onChange(a)}
          disabled={disabled}
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all ${
            value === a ? ACTION_PILL_ACTIVE[a] : ACTION_PILL_IDLE
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

/* ─── YAML parse / build ─────────────────────────────────────────────── */
type PolicyState = {
  piiMinScore: number;
  entities: Record<string, Action>;
  injectionAction: Action;
  onDetectorError: "fail_closed" | "fail_open";
  responseScanEnabled: boolean;
};

function parsePolicy(yaml: string): PolicyState {
  const state: PolicyState = {
    piiMinScore: 0.7,
    entities: {},
    injectionAction: "block",
    onDetectorError: "fail_closed",
    responseScanEnabled: false,
  };

  let inPii = false,
    inInjection = false,
    inResponseScan = false;

  for (const raw of yaml.split("\n")) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // Ignore blank lines and comments; keep section context.
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Top-level key (no leading whitespace) — resets section context
    if (!line.startsWith(" ")) {
      const topMatch = line.match(/^(\w[\w_]*):\s*(.*)/);
      if (!topMatch) continue;
      const [, key, val] = topMatch;
      inPii = inInjection = inResponseScan = false;
      if (key === "pii_min_score")
        state.piiMinScore = parseFloat(val ?? "0.7") || 0.7;
      else if (key === "on_detector_error")
        state.onDetectorError =
          val?.trim() === "fail_open" ? "fail_open" : "fail_closed";
      else if (key === "pii") inPii = true;
      else if (key === "injection") inInjection = true;
      else if (key === "response_scan") inResponseScan = true;
      continue;
    }

    // Indented key — only process if inside a known section
    const m = line.match(/^\s+([\w_]+):\s*(.*)/);
    if (!m) continue;
    const [, k, v] = m;
    const val = v?.trim() ?? "";
    if (inPii && ACTIONS.includes(val as Action))
      state.entities[k!] = val as Action;
    else if (inInjection && k === "action" && ACTIONS.includes(val as Action))
      state.injectionAction = val as Action;
    else if (inResponseScan && k === "enabled")
      state.responseScanEnabled = val === "true";
  }
  return state;
}

function buildPolicy(state: PolicyState): string {
  const lines: string[] = [
    "# PromptShield proxy policy",
    "# actions: allow | mask | block",
    "",
    `pii_min_score: ${state.piiMinScore.toFixed(2)}`,
    "",
    "pii:",
  ];
  for (const group of ENTITY_GROUPS) {
    const relevant = group.entities.filter((e) => e in state.entities);
    if (relevant.length === 0) continue;
    lines.push(`  # ${group.label}`);
    for (const entity of relevant)
      lines.push(`  ${entity}: ${state.entities[entity]}`);
    lines.push("");
  }
  const known = new Set(ALL_ENTITIES);
  for (const [entity, action] of Object.entries(state.entities)) {
    if (!known.has(entity)) lines.push(`  ${entity}: ${action}`);
  }
  lines.push("", "injection:", `  action: ${state.injectionAction}`, "");
  lines.push(`on_detector_error: ${state.onDetectorError}`, "");
  if (state.responseScanEnabled) {
    lines.push("response_scan:", "  enabled: true", "");
  }
  return lines.join("\n");
}

/* Skeleton  */
function Sk({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted/50 ${className}`}
      aria-hidden="true"
    />
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }

    const maybeShapeMessage = (error as { shape?: { message?: unknown } }).shape
      ?.message;
    if (typeof maybeShapeMessage === "string" && maybeShapeMessage.trim()) {
      return maybeShapeMessage;
    }
  }

  return fallback;
}

/* ─── Page ───────────────────────────────────────────────────────────── */
function PolicyPage() {
  const trpc = useTRPC();

  const [tab, setTab] = useState<"visual" | "yaml">("visual");
  const [editedYaml, setEditedYaml] = useState<string | null>(null);
  // All groups open by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(ENTITY_GROUPS.map((g) => g.label)),
  );

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  const currentFile = useQuery(trpc.policies.getCurrentFile.queryOptions());
  const sourceInfo = useQuery(trpc.policies.sourceInfo.queryOptions());
  const yamlContent = currentFile.data?.content ?? "";
  const activeYaml = editedYaml ?? yamlContent;
  const policy = parsePolicy(activeYaml);

  const saveFile = useMutation(
    trpc.policies.saveToFile.mutationOptions({
      onSuccess: () => {
        toast.success("Policy saved — proxy hot-reloaded");
        // Refetch first, then clear the local edit.
        currentFile.refetch().then(() => setEditedYaml(null));
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, "Failed to save policy"));
      },
    }),
  );

  function handleEntity(entity: string, action: Action) {
    setEditedYaml(
      buildPolicy({
        ...policy,
        entities: { ...policy.entities, [entity]: action },
      }),
    );
  }

  function handleGlobal(patch: Partial<PolicyState>) {
    setEditedYaml(buildPolicy({ ...policy, ...patch }));
  }

  function handleGroupSetAll(group: { entities: string[] }, action: Action) {
    const next = { ...policy.entities };
    for (const e of group.entities) next[e] = action;
    setEditedYaml(buildPolicy({ ...policy, entities: next }));
  }

  const isDirty = editedYaml !== null && editedYaml !== yamlContent;
  const loading = currentFile.isPending;
  const source = sourceInfo.data?.source ?? "local_file";
  const sourceLabel = source === "proxy_api" ? "Proxy API" : "Local File";
  const target = currentFile.data?.target ?? sourceInfo.data?.proxyPolicyEndpoint;

  // Coverage counts
  const configured = Object.entries(policy.entities);
  const countBy = (a: Action) => configured.filter(([, v]) => v === a).length;
  const nBlocked = countBy("block");
  const nMasked = countBy("mask");
  const nAllowed = countBy("allow"); // explicitly set to allow (not just defaulting)
  const nTotal = ALL_ENTITIES.length;
  const nConfigured = configured.filter(([k]) =>
    ALL_ENTITIES.includes(k),
  ).length;

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-[52px] items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-semibold text-foreground">Policy</h1>
          {!sourceInfo.isPending && (
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <Server size={10} aria-hidden="true" />
              {sourceLabel}
            </span>
          )}
          {!isDirty && !loading && (
            <span className="rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
              Active
            </span>
          )}
          {isDirty && (
            <span className="rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditedYaml(null);
              currentFile.refetch();
            }}
            disabled={currentFile.isFetching}
            aria-label="Reload from file"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
              className={
                currentFile.isFetching ? "motion-safe:animate-spin" : ""
              }
            />
          </button>
          <button
            onClick={() => saveFile.mutate({ content: activeYaml })}
            disabled={saveFile.isPending || !isDirty}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {saveFile.isPending ? "Saving…" : "Save Policy"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {!sourceInfo.isPending && (
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-[11px] text-muted-foreground">
                Policy source: <span className="font-semibold text-foreground">{sourceLabel}</span>
              </p>
              {target && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/60 break-all">
                  {target}
                </p>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-1 w-fit">
            {(["visual", "yaml"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "visual" ? "Visual Editor" : "YAML Config"}
              </button>
            ))}
          </div>

          {tab === "visual" ? (
            <>
              {/* Coverage summary */}
              {!loading && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
                    <div className="text-center">
                      <p className="text-lg font-semibold leading-none text-destructive tabular-nums">
                        {nBlocked}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                        Blocked
                      </p>
                    </div>
                    <div className="h-6 w-px bg-border" />
                    <div className="text-center">
                      <p className="text-lg font-semibold leading-none text-warning tabular-nums">
                        {nMasked}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                        Masked
                      </p>
                    </div>
                    <div className="h-6 w-px bg-border" />
                    <div className="text-center">
                      <p className="text-lg font-semibold leading-none text-success tabular-nums">
                        {nAllowed}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                        Allowed
                      </p>
                    </div>
                    <div className="h-6 w-px bg-border" />
                    <div className="text-center">
                      <p className="text-lg font-semibold leading-none text-muted-foreground/50 tabular-nums">
                        {nTotal - nConfigured}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                        Unset
                      </p>
                    </div>
                  </div>
                  {/* Coverage bar */}
                  <div className="hidden sm:flex flex-col gap-1 w-36 shrink-0">
                    <p className="text-[10px] text-muted-foreground/50">
                      {nConfigured}/{nTotal} with explicit rules
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 flex">
                      <div
                        className="h-full bg-destructive transition-[width] duration-500"
                        style={{ width: `${(nBlocked / nTotal) * 100}%` }}
                      />
                      <div
                        className="h-full bg-warning   transition-[width] duration-500"
                        style={{ width: `${(nMasked / nTotal) * 100}%` }}
                      />
                      <div
                        className="h-full bg-success/50 transition-[width] duration-500"
                        style={{ width: `${(nAllowed / nTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Global settings */}
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <h2 className="text-xs font-semibold text-foreground">
                    Global Settings
                  </h2>
                </div>
                <div className="divide-y divide-border">
                  {/* Min confidence */}
                  <div className="flex items-center justify-between gap-6 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        Min Confidence Score
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                        Detections below this threshold are ignored
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 w-48">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={policy.piiMinScore}
                        onChange={(e) =>
                          handleGlobal({
                            piiMinScore: parseFloat(e.target.value),
                          })
                        }
                        className="flex-1 accent-primary"
                        disabled={loading}
                      />
                      <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                        {policy.piiMinScore.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* On engine error */}
                  <div className="flex items-center justify-between gap-6 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        On Engine Error
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                        What to do when the detection engine is unreachable
                      </p>
                    </div>
                    <select
                      value={policy.onDetectorError}
                      onChange={(e) =>
                        handleGlobal({
                          onDetectorError: e.target.value as
                            | "fail_closed"
                            | "fail_open",
                        })
                      }
                      disabled={loading}
                      className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="fail_closed">
                        fail_closed — block (safe)
                      </option>
                      <option value="fail_open">
                        fail_open — allow unscanned
                      </option>
                    </select>
                  </div>

                  {/* Response scan */}
                  <div className="flex items-center justify-between gap-6 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        Scan LLM responses
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                        Apply PII rules to the model&apos;s output. Does not
                        apply to streaming.
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={policy.responseScanEnabled}
                      onClick={() =>
                        handleGlobal({
                          responseScanEnabled: !policy.responseScanEnabled,
                        })
                      }
                      disabled={loading}
                      className={`relative shrink-0 h-5 w-9 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                        policy.responseScanEnabled
                          ? "border-primary/40 bg-primary"
                          : "border-border bg-muted/40"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          policy.responseScanEnabled
                            ? "translate-x-4"
                            : "translate-x-0"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Entity rules */}
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <div>
                    <h2 className="text-xs font-semibold text-foreground">
                      Entity Rules
                    </h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Entities not listed default to{" "}
                      <span className="font-medium text-foreground">allow</span>
                      .
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {/* Header */}
                  <div
                    className="grid border-b border-border bg-muted/20 px-5 py-2"
                    style={{ gridTemplateColumns: "1fr auto" }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      Entity
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      Action
                    </span>
                  </div>

                  {loading ? (
                    <div className="divide-y divide-border">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-5 py-3"
                        >
                          <Sk className="h-2.5 w-32" />
                          <Sk className="h-6 w-[172px] rounded-md" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {ENTITY_GROUPS.map((group) => {
                        const isOpen = openGroups.has(group.label);
                        const groupConfigured = group.entities.filter(
                          (e) => e in policy.entities,
                        ).length;
                        return (
                          <div key={group.label}>
                            {/* Group header — split into clickable left and button controls right */}
                            <div className="flex w-full items-center justify-between border-b border-border/40 bg-muted/10 px-5 py-2 hover:bg-muted/20 transition-colors">
                              {/* Left side: clickable to collapse */}
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.label)}
                                className="flex items-center gap-2 flex-1 text-left -ml-5 -my-2 pl-5 pr-3 py-2"
                              >
                                <ChevronDown
                                  size={12}
                                  className={`shrink-0 text-muted-foreground/40 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                                  aria-hidden="true"
                                />
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wider ${group.color} opacity-70`}
                                >
                                  {group.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground/30">
                                  {groupConfigured}/{group.entities.length}
                                </span>
                              </button>
                              {/* Right side: quick set-all buttons */}
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground/30 mr-1">
                                  Set all:
                                </span>
                                {ACTIONS.map((a) => (
                                  <button
                                    key={a}
                                    type="button"
                                    onClick={() => handleGroupSetAll(group, a)}
                                    className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/30 hover:bg-accent hover:text-foreground transition-colors"
                                  >
                                    {a}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Entity rows — collapsed when group is closed */}
                            {isOpen && (
                              <div className="divide-y divide-border/30">
                                {group.entities.map((entity) => {
                                  const action = (policy.entities[entity] ??
                                    "allow") as Action;
                                  const isDefault = !(
                                    entity in policy.entities
                                  );
                                  return (
                                    <div
                                      key={entity}
                                      className="flex items-center justify-between px-5 py-2 transition-colors hover:bg-muted/10"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${ACTION_DOT[action]} ${isDefault ? "opacity-20" : ""}`}
                                          aria-hidden="true"
                                        />
                                        <span
                                          className={`truncate font-mono text-xs ${isDefault ? "text-muted-foreground/50" : "text-foreground"}`}
                                        >
                                          {entity}
                                        </span>
                                        {isDefault && (
                                          <span className="shrink-0 text-[9px] text-muted-foreground/30">
                                            default
                                          </span>
                                        )}
                                      </div>
                                      <ActionPills
                                        value={action}
                                        onChange={(a) =>
                                          handleEntity(entity, a)
                                        }
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* YAML editor */
            <div className="space-y-2">
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  YAML Config
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Edit{" "}
                  <code className="rounded bg-muted/60 px-1 font-mono text-[10px]">
                    policy.yaml
                  </code>{" "}
                  directly. The proxy hot-reloads on save — no restart required.
                </p>
              </div>
              <textarea
                value={activeYaml}
                onChange={(e) => setEditedYaml(e.target.value)}
                className="w-full h-[600px] resize-y rounded-lg border border-border bg-card p-5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="# policy.yaml"
                spellCheck={false}
              />
            </div>
          )}
        </div>
        {/* max-w-3xl */}
      </div>
      {/* scroll container */}
    </div>
  );
}
