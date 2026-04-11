import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_layout/proxy")({
  component: ProxyPage,
});

/* Types */
type Provider =
  | "gemini"
  | "openai"
  | "anthropic"
  | "openai-compatible"
  | "selfhosted";

const PROVIDERS: {
  id: Provider;
  label: string;
  defaultModel: string;
  keyVar: string;
}[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    keyVar: "GEMINI_API_KEY",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    keyVar: "OPENAI_API_KEY",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-3-5-sonnet-20241022",
    keyVar: "ANTHROPIC_API_KEY",
  },
  {
    id: "selfhosted",
    label: "Self-hosted / Ollama",
    defaultModel: "",
    keyVar: "SELFHOSTED_API_KEY",
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    defaultModel: "",
    keyVar: "",
  },
];

/* Helpers */
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

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </label>
      {children}
      {helper && (
        <p className="mt-1 text-[11px] text-muted-foreground/50">{helper}</p>
      )}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  mono = false,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${mono ? "font-mono" : ""}`}
      {...rest}
    />
  );
}

function SectionCard({
  title,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-border px-5 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-xs font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {open ? (
          <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}

/* API Key row */
function KeyRow({
  providerLabel,
  count,
  onAdd,
  onClear,
  adding,
  disabled = false,
}: {
  providerLabel: string;
  count: number;
  onAdd: (key: string) => void;
  onClear: () => void;
  adding: boolean;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [show, setShow] = useState(false);

  function submitKey() {
    if (!newKey.trim()) return;
    onAdd(newKey.trim());
    setNewKey("");
    setExpanded(false);
  }

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-medium text-foreground">
            {providerLabel}
          </span>
          {count > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-success">
              {count} key{count > 1 ? "s" : ""}
              {count > 1 && <span className="opacity-60">· round-robin</span>}
            </span>
          ) : (
            <span className="rounded-full bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground/50">
              not set
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {count > 0 && (
            <button
              onClick={onClear}
              disabled={disabled}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Clear all keys"
            >
              <Trash2 size={11} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            disabled={disabled}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus size={10} aria-hidden="true" />
            Add
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={show ? "text" : "password"}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitKey()}
                placeholder="Paste API key…"
                className="w-full rounded-md border border-border bg-background pr-8 pl-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
                aria-label={show ? "Hide key" : "Show key"}
              >
                {show ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </div>
            <button
              onClick={submitKey}
              disabled={!newKey.trim() || adding}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Check size={11} aria-hidden="true" />
              Add
            </button>
            <button
              onClick={() => {
                setExpanded(false);
                setNewKey("");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
            >
              <X size={11} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground/40">
            Key is stored in the proxy .env file. Multiple keys rotate in
            round-robin.
          </p>
        </div>
      )}
    </div>
  );
}

/* Page */
function ProxyPage() {
  const trpc = useTRPC();

  const proxyHealth = useQuery(
    trpc.proxy.health.queryOptions(undefined, { refetchInterval: 20_000 }),
  );
  const engineHealth = useQuery(
    trpc.proxy.engineHealth.queryOptions(undefined, {
      refetchInterval: 20_000,
    }),
  );
  const proxyConfig = useQuery(trpc.proxy.getConfig.queryOptions());
  const configSourceInfo = useQuery(trpc.proxy.configSourceInfo.queryOptions());

  const updateConfig = useMutation(
    trpc.proxy.updateConfig.mutationOptions({
      onSuccess: () => toast.success("Config saved — restart proxy to apply"),
      onError: (error) =>
        toast.error(getErrorMessage(error, "Failed to save config")),
    }),
  );

  const addKey = useMutation(
    trpc.proxy.addApiKey.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Key added (${data.count} total)`);
        proxyConfig.refetch();
      },
      onError: (error) =>
        toast.error(getErrorMessage(error, "Failed to add key")),
    }),
  );

  const clearKeys = useMutation(
    trpc.proxy.clearApiKeys.mutationOptions({
      onSuccess: () => {
        toast.success("Keys cleared");
        proxyConfig.refetch();
      },
      onError: (error) =>
        toast.error(getErrorMessage(error, "Failed to clear keys")),
    }),
  );

  // Form state — initialised from fetched config
  const [mode, setMode] = useState<"gateway" | "security">("security");
  const [engineUrl, setEngineUrl] = useState("");
  const [providerMode, setProviderMode] = useState<"single" | "multi">(
    "single",
  );
  const [provider, setProvider] = useState<Provider>("gemini");
  const [upstreamUrl, setUpstreamUrl] = useState("");
  const [model, setModel] = useState("");
  const [providers, setProviders] = useState<Provider[]>(["gemini"]);
  const [providerUrls, setProviderUrls] = useState<Record<string, string>>({});
  const [modelRoutes, setModelRoutes] = useState<
    { model: string; provider: string }[]
  >([]);
  const [port, setPort] = useState("8080");
  const [chatRoute, setChatRoute] = useState("/v1/chat/completions");
  const [policyPath, setPolicyPath] = useState("config/policy.yaml");
  const [isDirty, setIsDirty] = useState(false);

  // Populate form when config loads
  useEffect(() => {
    const d = proxyConfig.data;
    if (!d) return;
    setMode(d.mode as "gateway" | "security");
    setEngineUrl(d.engineUrl);
    setProviderMode(d.providerMode as "single" | "multi");
    setProvider(d.provider as Provider);
    setUpstreamUrl(d.upstreamUrl);
    setModel(d.models?.global ?? "");
    setProviders(d.providers as Provider[]);
    setProviderUrls(d.providerUrls ?? {});
    setModelRoutes(d.modelRoutes ?? []);
    setPort(d.port);
    setChatRoute(d.chatRoute);
    setPolicyPath(d.policyPath);
    setIsDirty(false);
  }, [proxyConfig.data]);

  function markDirty() {
    setIsDirty(true);
  }

  function handleSave() {
    const validProviderIds = new Set<Provider>(PROVIDERS.map((p) => p.id));
    const validModelRoutes = modelRoutes.filter(
      (route): route is { model: string; provider: Provider } =>
        validProviderIds.has(route.provider as Provider),
    );

    if (validModelRoutes.length !== modelRoutes.length) {
      toast.warning(
        "Some model routes have invalid providers and were ignored",
      );
    }

    updateConfig.mutate({
      mode,
      engineUrl,
      providerMode,
      provider,
      upstreamUrl,
      providers,
      providerUrls,
      models: {
        global: model,
        gemini: "",
        openai: "",
        anthropic: "",
        selfhosted: "",
      },
      modelRoutes: validModelRoutes,
      port,
      chatRoute,
      policyPath,
    });
    setIsDirty(false);
  }

  const proxyOnline = proxyHealth.data?.online ?? false;
  const engineOnline = engineHealth.data?.online ?? false;
  const isRefreshing =
    proxyHealth.isFetching || engineHealth.isFetching || proxyConfig.isFetching;
  const loading = proxyConfig.status === "pending";
  const isProxyApiConfig = configSourceInfo.data?.source === "proxy_api";

  const keyCounts = proxyConfig.data?.keyCounts ?? {
    upstream: 0,
    gemini: 0,
    openai: 0,
    anthropic: 0,
  };

  // Multi-provider toggle helpers
  function toggleProvider(p: Provider) {
    setProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
    markDirty();
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 flex h-[52px] items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-semibold text-foreground">Proxy</h1>
          {!configSourceInfo.isPending && (
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <Server size={10} aria-hidden="true" />
              {isProxyApiConfig ? "Proxy API" : "Local Env"}
            </span>
          )}
          {/* Live status pills */}
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              proxyOnline
                ? "border-success/25 bg-success/10 text-success"
                : "border-destructive/25 bg-destructive/10 text-destructive"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${proxyOnline ? "bg-success motion-safe:animate-pulse" : "bg-destructive"}`}
              aria-hidden="true"
            />
            Proxy
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              engineOnline
                ? "border-success/25 bg-success/10 text-success"
                : "border-muted/40 bg-muted/20 text-muted-foreground/50"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${engineOnline ? "bg-success motion-safe:animate-pulse" : "bg-muted-foreground/30"}`}
              aria-hidden="true"
            />
            Engine
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
              Unsaved changes
            </span>
          )}
          <button
            onClick={() => {
              proxyHealth.refetch();
              engineHealth.refetch();
              proxyConfig.refetch();
            }}
            disabled={isRefreshing}
            aria-label="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
              className={isRefreshing ? "motion-safe:animate-spin" : ""}
            />
          </button>
          <button
            onClick={handleSave}
            disabled={updateConfig.isPending || !isDirty}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {updateConfig.isPending ? "Saving…" : "Save Config"}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
        {isProxyApiConfig && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-[11px] text-primary/90">
              Provider/model settings are managed via external proxy config endpoint.
            </p>
            {configSourceInfo.data?.proxyConfigEndpoint && (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground/60 break-all">
                {configSourceInfo.data.proxyConfigEndpoint}
              </p>
            )}
          </div>
        )}

        {/* Overview section */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Active providers */}
          <div className="rounded-lg border border-border bg-card px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Active Providers
            </p>
            {loading ? (
              <Sk className="mt-2 h-5 w-full" />
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {providers.length > 0 ? (
                  providers.map((p) => {
                    const label = PROVIDERS.find((x) => x.id === p)?.label ?? p;
                    return (
                      <span
                        key={p}
                        className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-primary"
                      >
                        {label}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[11px] text-muted-foreground/40">
                    None configured
                  </span>
                )}
              </div>
            )}
          </div>

          {/* API keys status */}
          <div className="rounded-lg border border-border bg-card px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              API Keys Configured
            </p>
            {loading ? (
              <Sk className="mt-2 h-5 w-full" />
            ) : (
              <div className="mt-2.5 space-y-1">
                {Object.entries(keyCounts).map(([provider, count]) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-muted-foreground capitalize">
                      {provider === "upstream"
                        ? "Global"
                        : PROVIDERS.find((x) => x.id === provider)?.label ??
                          provider}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        count > 0
                          ? "text-success"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Route URLs */}
          <div className="rounded-lg border border-border bg-card px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Route Info
            </p>
            {loading ? (
              <Sk className="mt-2 h-5 w-full" />
            ) : (
              <div className="mt-2.5 space-y-2 text-[10px]">
                <div>
                  <p className="text-muted-foreground/60">Chat Endpoint</p>
                  <p className="font-mono text-muted-foreground break-all">
                    {`http://localhost:${port}${chatRoute}`}
                  </p>
                </div>
                {mode === "security" && (
                  <div>
                    <p className="text-muted-foreground/60">Engine</p>
                    <p className="font-mono text-muted-foreground break-all">
                      {engineUrl || "not set"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status cards  */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              label: "Proxy",
              online: proxyOnline,
              url: proxyHealth.data?.url ?? "http://localhost:8080",
              latency: proxyHealth.data?.latencyMs,
              loading: proxyHealth.isPending,
            },
            {
              label: "Detection Engine",
              online: engineOnline,
              url: engineHealth.data?.url ?? "http://localhost:8000",
              latency: engineHealth.data?.latencyMs,
              loading: engineHealth.isPending,
              note:
                mode === "gateway" ? "Gateway mode — not in use" : undefined,
            },
          ].map((svc) => (
            <div
              key={svc.label}
              className="rounded-lg border border-border bg-card px-4 py-3.5"
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold text-foreground">
                  {svc.label}
                </p>
                {svc.loading ? (
                  <Sk className="h-5 w-14 rounded-full" />
                ) : (
                  <span
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      svc.online
                        ? "border-success/25 bg-success/10 text-success"
                        : "border-destructive/25 bg-destructive/10 text-destructive"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${svc.online ? "bg-success motion-safe:animate-pulse" : "bg-destructive"}`}
                      aria-hidden="true"
                    />
                    {svc.online ? "Online" : "Offline"}
                  </span>
                )}
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground/60 break-all">
                {svc.url}
              </p>
              {svc.latency != null && (
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/40">
                  {svc.latency}ms
                </p>
              )}
              {svc.note && (
                <p className="mt-1 text-[10px] text-muted-foreground/40 italic">
                  {svc.note}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Mode */}
        <SectionCard
          title="Mode"
          description="How the proxy processes requests"
        >
          {loading ? (
            <Sk className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    id: "gateway" as const,
                    label: "Gateway Mode",
                    desc: "Transparent proxy — routing, rate limiting, token tracking. No PII scanning. Zero extra dependencies.",
                  },
                  {
                    id: "security" as const,
                    label: "Security Mode",
                    desc: "Full PII and secrets detection on every request via the detection engine.",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setMode(opt.id);
                    markDirty();
                  }}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    mode === opt.id
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-background hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${mode === opt.id ? "bg-primary" : "bg-muted-foreground/30"}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-foreground">
                      {opt.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          )}

          {mode === "security" && !loading && (
            <Field
              label="Engine URL"
              helper="The detection engine endpoint (PROMPTSHIELD_ENGINE_URL)"
            >
              <Input
                value={engineUrl}
                onChange={(e) => {
                  setEngineUrl(e.target.value);
                  markDirty();
                }}
                placeholder="http://localhost:4321"
                mono
              />
            </Field>
          )}
        </SectionCard>

        {/* Provider */}
        <SectionCard
          title="Provider"
          description="Which LLM provider(s) to route traffic to"
        >
          {loading ? (
            <Sk className="h-24 w-full" />
          ) : (
            <>
              {/* Single / Multi toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-0.5 w-fit">
                {(["single", "multi"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setProviderMode(m);
                      markDirty();
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      providerMode === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "single" ? "Single Provider" : "Multi-Provider"}
                  </button>
                ))}
              </div>

              {providerMode === "single" ? (
                <div className="space-y-3">
                  <Field label="Provider">
                    <select
                      value={provider}
                      onChange={(e) => {
                        setProvider(e.target.value as Provider);
                        markDirty();
                      }}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Upstream URL override"
                    helper="Leave blank to use the provider default endpoint"
                  >
                    <Input
                      value={upstreamUrl}
                      onChange={(e) => {
                        setUpstreamUrl(e.target.value);
                        markDirty();
                      }}
                      placeholder={
                        PROVIDERS.find((p) => p.id === provider)?.id ===
                        "selfhosted"
                          ? "http://localhost:11434/v1"
                          : "auto"
                      }
                      mono
                    />
                  </Field>
                  <Field
                    label="Default model"
                    helper="Optional — override per-request if omitted"
                  >
                    <Input
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        markDirty();
                      }}
                      placeholder={
                        PROVIDERS.find((p) => p.id === provider)
                          ?.defaultModel ?? ""
                      }
                      mono
                    />
                  </Field>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Active providers — first in list is the fallback
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PROVIDERS.filter(
                        (p) => p.id !== "openai-compatible",
                      ).map((p) => {
                        const active = providers.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleProvider(p.id)}
                            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border bg-background text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {active && <Check size={10} aria-hidden="true" />}
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-provider URL overrides */}
                  {providers.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Upstream URL overrides (optional)
                      </p>
                      {providers.map((p) => (
                        <Field
                          key={p}
                          label={PROVIDERS.find((x) => x.id === p)?.label ?? p}
                        >
                          <Input
                            value={providerUrls[p] ?? ""}
                            onChange={(e) => {
                              setProviderUrls((prev) => ({
                                ...prev,
                                [p]: e.target.value,
                              }));
                              markDirty();
                            }}
                            placeholder="auto"
                            mono
                          />
                        </Field>
                      ))}
                    </div>
                  )}

                  {/* Model routes */}
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Custom model routes
                    </p>
                    <div className="overflow-hidden rounded-md border border-border">
                      <div className="grid grid-cols-[1fr_1fr_32px] gap-0 border-b border-border bg-muted/20 px-3 py-2">
                        {["Model pattern", "Provider", ""].map((h) => (
                          <span
                            key={h}
                            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      {/* Built-in routes */}
                      {[
                        { model: "gpt-*, o1*, o3*", provider: "openai" },
                        { model: "gemini-*", provider: "gemini" },
                      ].map((r) => (
                        <div
                          key={r.model}
                          className="grid grid-cols-[1fr_1fr_32px] items-center gap-0 border-b border-border/40 px-3 py-2 last:border-0"
                        >
                          <span className="font-mono text-[11px] text-muted-foreground/50">
                            {r.model}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground/50">
                            {r.provider}
                          </span>
                          <span className="text-[9px] text-muted-foreground/30">
                            built-in
                          </span>
                        </div>
                      ))}
                      {modelRoutes.map((r, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_1fr_32px] items-center gap-2 border-b border-border/40 px-3 py-1.5 last:border-0"
                        >
                          <input
                            value={r.model}
                            onChange={(e) => {
                              const next = [...modelRoutes];
                              next[i] = { ...next[i]!, model: e.target.value };
                              setModelRoutes(next);
                              markDirty();
                            }}
                            placeholder="model-name"
                            className="rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                          <input
                            value={r.provider}
                            onChange={(e) => {
                              const next = [...modelRoutes];
                              next[i] = {
                                ...next[i]!,
                                provider: e.target.value,
                              };
                              setModelRoutes(next);
                              markDirty();
                            }}
                            placeholder="provider"
                            className="rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                          <button
                            onClick={() => {
                              setModelRoutes(
                                modelRoutes.filter((_, j) => j !== i),
                              );
                              markDirty();
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive"
                          >
                            <X size={11} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setModelRoutes([
                            ...modelRoutes,
                            { model: "", provider: "" },
                          ]);
                          markDirty();
                        }}
                        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-[11px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                      >
                        <Plus size={11} aria-hidden="true" />
                        Add route
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </SectionCard>

        {/* API Keys */}
        <SectionCard
          title="Upstream API Keys"
          description="Server-side fallback keys sent to the LLM provider. Multiple keys rotate in round-robin."
        >
          {loading ? (
            <Sk className="h-24 w-full" />
          ) : (
            <div className="space-y-2">
              {(
                [
                  {
                    provider: "gemini",
                    label: "Google Gemini",
                    count: keyCounts.gemini,
                  },
                  {
                    provider: "openai",
                    label: "OpenAI",
                    count: keyCounts.openai,
                  },
                  {
                    provider: "anthropic",
                    label: "Anthropic",
                    count: keyCounts.anthropic,
                  },
                  {
                    provider: "upstream",
                    label: "Global fallback (single-provider)",
                    count: keyCounts.upstream,
                  },
                ] as const
              ).map((row) => (
                <KeyRow
                  key={row.provider}
                  providerLabel={row.label}
                  count={row.count}
                  onAdd={(key) =>
                    addKey.mutate({ provider: row.provider, key })
                  }
                  onClear={() => clearKeys.mutate({ provider: row.provider })}
                  adding={addKey.isPending}
                  disabled={isProxyApiConfig}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Advanced */}
        <SectionCard
          title="Advanced"
          description="Port, routing, policy path"
          defaultOpen={false}
        >
          {loading ? (
            <Sk className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Port" helper="PROMPTSHIELD_PORT">
                <Input
                  value={port}
                  onChange={(e) => {
                    setPort(e.target.value);
                    markDirty();
                  }}
                  placeholder="8080"
                  mono
                />
              </Field>
              <Field
                label="Chat completions route"
                helper="PROMPTSHIELD_CHAT_ROUTE"
              >
                <Input
                  value={chatRoute}
                  onChange={(e) => {
                    setChatRoute(e.target.value);
                    markDirty();
                  }}
                  placeholder="/v1/chat/completions"
                  mono
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Policy file path"
                  helper="PROMPTSHIELD_POLICY_PATH — relative to proxy working directory"
                >
                  <Input
                    value={policyPath}
                    onChange={(e) => {
                      setPolicyPath(e.target.value);
                      markDirty();
                    }}
                    placeholder="config/policy.yaml"
                    mono
                  />
                </Field>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Restart note */}
        <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
          <AlertTriangle
            size={13}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              Restart required.
            </span>{" "}
            Config changes are written to the proxy{" "}
            <code className="rounded bg-muted/60 px-1 font-mono text-[10px]">
              .env
            </code>{" "}
            file. The proxy must be restarted to pick them up. Policy changes ({" "}
            <code className="rounded bg-muted/60 px-1 font-mono text-[10px]">
              policy.yaml
            </code>{" "}
            ) hot-reload automatically — no restart needed.
          </p>
        </div>
      </div>
    </div>
  );
}
