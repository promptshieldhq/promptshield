import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_layout/engine")({
  component: EnginePage,
});

/* Helpers */
function Sk({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted/50 ${className}`}
      aria-hidden="true"
    />
  );
}

type Detection = {
  entity_type: string;
  score: number;
  start: number;
  end: number;
};

function confidenceColor(score: number) {
  if (score >= 0.9)
    return "border-destructive/20 bg-destructive/8 text-destructive";
  if (score >= 0.7) return "border-warning/20 bg-warning/8 text-warning";
  return "border-border bg-muted/50 text-muted-foreground";
}

/* Mask config labels */
const MASK_KEYS: { key: string; label: string; group: string }[] = [
  { key: "maskEmail", label: "Email address", group: "Contact" },
  { key: "maskPhoneNumber", label: "Phone number", group: "Contact" },
  { key: "maskUrl", label: "URL", group: "Contact" },
  { key: "maskAddress", label: "Physical address", group: "Contact" },
  { key: "maskUserName", label: "Username", group: "Identity" },
  { key: "maskOrganization", label: "Organization", group: "Identity" },
  { key: "maskBankNumber", label: "Bank number", group: "Financial" },
  { key: "maskPayment", label: "Payment info", group: "Financial" },
  { key: "maskPassword", label: "Password", group: "Credentials" },
  { key: "maskPrivateKey", label: "Private key", group: "Credentials" },
  {
    key: "maskVerificationCode",
    label: "Verification code",
    group: "Credentials",
  },
  { key: "maskRandomSeed", label: "Random seed / token", group: "Credentials" },
  { key: "maskAll", label: "Mask everything", group: "Global" },
];

const MASK_GROUPS = [
  "Global",
  "Contact",
  "Identity",
  "Financial",
  "Credentials",
];

/* Page */
function EnginePage() {
  const trpc = useTRPC();

  const engineHealth = useQuery(
    trpc.proxy.engineHealth.queryOptions(undefined, {
      refetchInterval: 15_000,
    }),
  );
  const engineConfig = useQuery(trpc.proxy.getEngineConfig.queryOptions());

  const updateEngineConfig = useMutation(
    trpc.proxy.updateEngineConfig.mutationOptions({
      onSuccess: () => toast.success("Engine config updated"),
      onError: () => toast.error("Failed to update engine config"),
    }),
  );

  const [testText, setTestText] = useState("");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Mask config state — derived from fetched config
  const remoteMaskCfg = engineConfig.data?.maskConfig ?? {};
  const [maskCfg, setMaskCfg] = useState<Record<string, boolean> | null>(null);
  const activeMask = maskCfg ?? remoteMaskCfg;
  const maskDirty =
    maskCfg !== null &&
    JSON.stringify(maskCfg) !== JSON.stringify(remoteMaskCfg);

  function toggleMask(key: string) {
    setMaskCfg({ ...activeMask, [key]: !activeMask[key] });
  }

  function saveMask() {
    updateEngineConfig.mutate({ maskConfig: activeMask });
    setMaskCfg(null);
  }

  async function runDetection() {
    if (!testText.trim()) return;
    setDetecting(true);
    try {
      const res = await fetch("/internal/engine/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText }),
      });
      const data = (await res.json()) as { entities?: Detection[] };
      setDetections(data.entities ?? []);
      setHasRun(true);
    } catch {
      toast.error("Engine unreachable — check connection settings");
    } finally {
      setDetecting(false);
    }
  }

  const online = engineHealth.data?.online ?? false;
  const latencyMs = engineHealth.data?.latencyMs;
  const engineUrl = engineHealth.data?.url ?? "http://localhost:8000";

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-[52px] items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-sm">
        <h1 className="text-sm font-semibold text-foreground">
          Detection Engine
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              engineHealth.refetch();
              engineConfig.refetch();
            }}
            disabled={engineHealth.isFetching}
            aria-label="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
              className={
                engineHealth.isFetching ? "motion-safe:animate-spin" : ""
              }
            />
          </button>
          {engineHealth.isPending ? (
            <Sk className="h-6 w-16 rounded-full" />
          ) : (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                online
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${online ? "bg-success motion-safe:animate-pulse" : "bg-destructive"}`}
                aria-hidden="true"
              />
              {online ? "Online" : "Offline"}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 p-6">
        {/* Status card */}
        <div className="rounded-lg border border-border bg-card px-5 py-4">
          {engineHealth.isPending ? (
            <div className="grid grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Sk className="h-2 w-20" />
                  <Sk className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  Service URL
                </p>
                <p className="mt-1 font-mono text-xs text-foreground break-all">
                  {engineUrl}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  Latency
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                  {latencyMs != null ? `${latencyMs}ms` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  Framework
                </p>
                <p className="mt-1 font-mono text-xs text-foreground">
                  Microsoft Presidio + spaCy
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Injection detection stub warning */}
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
          <AlertTriangle
            size={13}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-semibold text-foreground">
              Injection detection — stub
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              The engine always returns{" "}
              <code className="rounded bg-muted/60 px-1 font-mono text-[10px]">
                injection_detected: false
              </code>
              . The detection hook is wired — plug in a model (e.g.{" "}
              <code className="rounded bg-muted/60 px-1 font-mono text-[10px]">
                deberta-v3-base-prompt-injection-v2
              </code>
              ) to activate it.
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Live detection test — 3 cols */}
          <div className="lg:col-span-3">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-xs font-semibold text-foreground">
                  Live Detection Test
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Paste any text — the engine detects PII, secrets, and
                  credentials
                </p>
              </div>

              <div className="p-5 space-y-4">
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder={`Try pasting a .env file or a prompt with sensitive data:\n\nAWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE\nOpenAI key: sk-proj-abc123...\nContact: john@company.com`}
                  className="w-full h-36 resize-none rounded-md border border-border bg-background p-4 font-mono text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  spellCheck={false}
                />

                <div className="flex items-center justify-end">
                  <button
                    onClick={runDetection}
                    disabled={detecting || !testText.trim()}
                    className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {detecting ? (
                      <>
                        <span
                          className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white"
                          aria-hidden="true"
                        />
                        Detecting…
                      </>
                    ) : (
                      "Run Detection"
                    )}
                  </button>
                </div>

                {hasRun && (
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          {["Entity", "Confidence", "Position"].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {detections.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-6 text-center text-xs text-success font-medium"
                            >
                              ✓ No entities detected
                            </td>
                          </tr>
                        ) : (
                          detections.map((d, i) => (
                            <tr
                              key={i}
                              className="hover:bg-muted/10 transition-colors"
                            >
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                                {d.entity_type}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${confidenceColor(d.score)}`}
                                >
                                  {(d.score * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-muted-foreground/60">
                                {d.start}–{d.end}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column — entity categories + mask config */}
          <div className="space-y-4 lg:col-span-2">
            {/* Detected entity types */}
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-xs font-semibold text-foreground">
                  Detected Entity Types
                </h2>
              </div>
              <div className="space-y-3 px-5 py-4">
                {[
                  {
                    label: "Personal PII",
                    items: [
                      "EMAIL_ADDRESS",
                      "PHONE_NUMBER",
                      "PERSON",
                      "PHYSICAL_ADDRESS",
                      "IP_ADDRESS",
                      "USER_NAME",
                    ],
                  },
                  {
                    label: "Credentials",
                    items: [
                      "AWS_ACCESS_KEY",
                      "AWS_SECRET_KEY",
                      "GITHUB_TOKEN",
                      "OPENAI_API_KEY",
                      "STRIPE_KEY",
                      "SLACK_TOKEN",
                      "GOOGLE_API_KEY",
                      "BEARER_TOKEN",
                      "API_KEY",
                      "PASSWORD",
                      "PRIVATE_KEY",
                    ],
                  },
                  {
                    label: "Financial",
                    items: [
                      "CREDIT_CARD",
                      "US_SSN",
                      "IBAN_CODE",
                      "BANK_NUMBER",
                      "US_PASSPORT",
                    ],
                  },
                ].map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.items.map((item) => (
                        <span
                          key={item}
                          className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-foreground/70"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mask config */}
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div>
                  <h2 className="text-xs font-semibold text-foreground">
                    Anonymization Config
                  </h2>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                    Which entity types the engine masks on detection
                  </p>
                </div>
                {maskDirty && (
                  <button
                    onClick={saveMask}
                    disabled={updateEngineConfig.isPending}
                    className="shrink-0 rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {updateEngineConfig.isPending ? "Saving…" : "Apply"}
                  </button>
                )}
              </div>

              {engineConfig.status === "pending" ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Sk key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : engineConfig.data?.maskConfig === null ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-[11px] text-muted-foreground/60">
                    Engine offline — config unavailable
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {MASK_GROUPS.map((group) => {
                    const keys = MASK_KEYS.filter((k) => k.group === group);
                    if (!keys.length) return null;
                    return (
                      <div key={group}>
                        <p className="bg-muted/10 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                          {group}
                        </p>
                        {keys.map(({ key, label }) => (
                          <div
                            key={key}
                            className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/10"
                          >
                            <span className="text-[11px] text-foreground">
                              {label}
                            </span>
                            <button
                              role="switch"
                              aria-checked={activeMask[key] ?? false}
                              onClick={() => toggleMask(key)}
                              className={`relative h-4 w-7 rounded-full border transition-colors ${
                                activeMask[key]
                                  ? "border-primary/40 bg-primary"
                                  : "border-border bg-muted/40"
                              }`}
                            >
                              <span
                                className={`absolute top-0 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                                  activeMask[key]
                                    ? "translate-x-3"
                                    : "translate-x-0"
                                }`}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/40">
          <span>Microsoft Presidio + spaCy</span>
          <span>·</span>
          <span>Multi-language: en / zh / fr / de / ko / ja</span>
          <span>·</span>
          <span>Injection detection: stub (not active)</span>
        </div>
      </div>
    </div>
  );
}
