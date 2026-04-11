import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Server,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_layout/config")({
  component: ConfigPage,
});

/* Shared helpers */
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

/* Proxy tab */
function ProxyTab() {
  const trpc = useTRPC();

  const urls = useQuery(trpc.proxy.getUrls.queryOptions());
  const proxyHealth = useQuery(
    trpc.proxy.health.queryOptions(undefined, { refetchInterval: 20_000 }),
  );
  const checkUrl = useMutation(trpc.proxy.checkUrl.mutationOptions());
  const saveProxyUrl = useMutation(trpc.proxy.saveProxyUrl.mutationOptions());
  const resetProxyUrl = useMutation(
    trpc.proxy.resetProxyUrl.mutationOptions(),
  );
  const policySourceInfo = useQuery(trpc.policies.sourceInfo.queryOptions());
  const fileMeta = useQuery(trpc.policies.fileMeta.queryOptions());
  const checkPath = useMutation(trpc.policies.checkFilePath.mutationOptions());
  const savePath = useMutation(trpc.policies.saveFilePath.mutationOptions());

  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [checkedUrl, setCheckedUrl] = useState<{
    online: boolean;
    latencyMs: number | null;
  } | null>(null);

  const remotePath = fileMeta.data?.path ?? "";
  const [path, setPath] = useState<string | null>(null);
  const [checked, setChecked] = useState<{
    exists: boolean;
    sizeBytes: number | null;
  } | null>(null);

  useEffect(() => {
    if (path === null && fileMeta.status === "success") setPath(remotePath);
  }, [fileMeta.status, remotePath]);

  const remoteProxyUrl = urls.data?.proxyUrl ?? "";
  useEffect(() => {
    if (proxyUrl === null && urls.status === "success") {
      setProxyUrl(remoteProxyUrl);
    }
  }, [proxyUrl, remoteProxyUrl, urls.status]);

  const editorProxyUrl = proxyUrl ?? remoteProxyUrl;
  const isProxyDirty =
    proxyUrl !== null && editorProxyUrl.trim() !== remoteProxyUrl.trim();
  const editorPath = path ?? remotePath;
  const isDirty = path !== null && path.trim() !== remotePath.trim();
  const isProxyPolicySource = policySourceInfo.data?.source === "proxy_api";
  const isRefreshing =
    proxyHealth.isFetching ||
    fileMeta.isFetching ||
    urls.isFetching ||
    policySourceInfo.isFetching;

  async function handleCheckProxyUrl() {
    const trimmedUrl = editorProxyUrl.trim();
    if (!trimmedUrl) {
      toast.error("Proxy URL is required");
      return;
    }

    setCheckedUrl(null);
    try {
      const result = await checkUrl.mutateAsync({
        url: trimmedUrl,
        healthPath: "/health",
      });
      setCheckedUrl(result);
      if (!result.online) {
        toast.warning("Proxy health check failed");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to validate proxy URL"));
    }
  }

  async function handleSaveProxyUrl() {
    const trimmedUrl = editorProxyUrl.trim();
    if (!trimmedUrl) {
      toast.error("Proxy URL is required");
      return;
    }

    try {
      await saveProxyUrl.mutateAsync({ url: trimmedUrl });
      toast.success("Proxy URL saved");
      setProxyUrl(null);
      setCheckedUrl(null);
      await Promise.all([urls.refetch(), proxyHealth.refetch()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save proxy URL"));
    }
  }

  async function handleResetProxyUrl() {
    try {
      await resetProxyUrl.mutateAsync();
      toast.success("Proxy URL override cleared");
      setProxyUrl(null);
      setCheckedUrl(null);
      await Promise.all([urls.refetch(), proxyHealth.refetch()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reset proxy URL"));
    }
  }

  async function handleCheck() {
    const trimmedPath = editorPath.trim();
    if (!trimmedPath) {
      toast.error("Path is required");
      return;
    }

    setChecked(null);
    try {
      const result = await checkPath.mutateAsync({ path: trimmedPath });
      setChecked(result);
      if (!result.exists) {
        toast.warning("File not found at this path");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to validate path"));
    }
  }

  async function handleSave() {
    const trimmedPath = editorPath.trim();
    if (!trimmedPath) {
      toast.error("Path is required");
      return;
    }

    try {
      await savePath.mutateAsync({ path: trimmedPath });
      toast.success("Policy path saved");
      setPath(null);
      setChecked(null);
      await fileMeta.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save path"));
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            urls.refetch();
            proxyHealth.refetch();
            fileMeta.refetch();
            setCheckedUrl(null);
            setChecked(null);
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
      </div>

      {/* Proxy status card */}
      <div className="rounded-lg border border-border bg-card px-4 py-3.5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold text-foreground">Proxy</p>
          {proxyHealth.isPending ? (
            <Sk className="h-5 w-14 rounded-full" />
          ) : (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                proxyHealth.data?.online
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${proxyHealth.data?.online ? "bg-success motion-safe:animate-pulse" : "bg-destructive"}`}
                aria-hidden="true"
              />
              {proxyHealth.data?.online ? "Online" : "Offline"}
            </span>
          )}
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground/60 break-all">
          {proxyHealth.data?.url ?? "Not configured"}
        </p>
        {proxyHealth.data?.latencyMs != null && (
          <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/40">
            {proxyHealth.data.latencyMs}ms
          </p>
        )}
      </div>

      {/* Proxy URL configuration */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Server size={13} className="text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Proxy Service URL
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                Base URL used by the dashboard to reach PromptShield proxy
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {urls.isPending ? (
            <Sk className="h-4 w-64" />
          ) : (
            <div className="space-y-1 text-[10px] text-muted-foreground/60">
              <p className="font-mono break-all">Current: {urls.data?.proxyUrl ?? "—"}</p>
              <p>Deployment URL is used when no override is set.</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Update proxy URL
            </label>
            <div className="flex items-center gap-2">
              <input
                value={editorProxyUrl}
                onChange={(e) => {
                  setProxyUrl(e.target.value);
                  setCheckedUrl(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCheckProxyUrl()}
                placeholder="https://proxy.your-domain.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                spellCheck={false}
              />
              <button
                onClick={handleCheckProxyUrl}
                disabled={
                  !editorProxyUrl.trim() ||
                  checkUrl.isPending ||
                  saveProxyUrl.isPending ||
                  resetProxyUrl.isPending
                }
                className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                {checkUrl.isPending ? "Checking..." : "Validate"}
              </button>
              <button
                onClick={handleSaveProxyUrl}
                disabled={
                  saveProxyUrl.isPending ||
                  checkUrl.isPending ||
                  resetProxyUrl.isPending ||
                  !isProxyDirty
                }
                className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saveProxyUrl.isPending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleResetProxyUrl}
                disabled={
                  resetProxyUrl.isPending ||
                  saveProxyUrl.isPending ||
                  checkUrl.isPending
                }
                className="shrink-0 flex items-center gap-1 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <RotateCcw size={11} aria-hidden="true" />
                Clear
              </button>
            </div>
          </div>

          {checkedUrl !== null && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 ${
                checkedUrl.online
                  ? "border-success/20 bg-success/5"
                  : "border-destructive/20 bg-destructive/5"
              }`}
            >
              {checkedUrl.online ? (
                <>
                  <Check size={12} className="shrink-0 text-success" aria-hidden="true" />
                  <p className="text-[11px] text-success font-medium">
                    Service reachable
                    {checkedUrl.latencyMs != null && (
                      <span className="ml-1.5 font-normal opacity-70">
                        · {checkedUrl.latencyMs}ms
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle
                    size={12}
                    className="shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <p className="text-[11px] text-destructive font-medium">
                    Could not reach the proxy health endpoint
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Policy file path */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText
              size={13}
              className="text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Policy File Path
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                {isProxyPolicySource
                  ? "Managed by external proxy API in this environment"
                  : "Where the proxy reads policy.yaml from"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {isProxyPolicySource && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
              <p className="text-[11px] text-primary/90">
                Path overrides are disabled because <span className="font-mono">POLICY_SOURCE=proxy_api</span>.
              </p>
              {policySourceInfo.data?.proxyPolicyEndpoint && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/60 break-all">
                  {policySourceInfo.data.proxyPolicyEndpoint}
                </p>
              )}
            </div>
          )}

          {/* Current file meta */}
          {fileMeta.isPending ? (
            <div className="flex items-center gap-3">
              <Sk className="h-4 w-64" />
              <Sk className="h-4 w-16 rounded-full" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground/70 break-all">
                {fileMeta.data?.path ?? "—"}
              </span>
              {fileMeta.data && (
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    fileMeta.data.exists
                      ? "border-success/25 bg-success/10 text-success"
                      : "border-destructive/25 bg-destructive/10 text-destructive"
                  }`}
                >
                  {fileMeta.data.exists ? "Found" : "Not found"}
                </span>
              )}
              {fileMeta.data?.sizeBytes != null && (
                <span className="shrink-0 text-[10px] text-muted-foreground/40">
                  {(fileMeta.data.sizeBytes / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          )}

          {/* Path input */}
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Change path
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FolderOpen
                  size={12}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
                  aria-hidden="true"
                />
                <input
                  value={editorPath}
                  onChange={(e) => {
                    setPath(e.target.value);
                    setChecked(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                  placeholder="config/policy.yaml"
                  className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  spellCheck={false}
                />
                {isDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setPath(remotePath);
                      setChecked(null);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground"
                    aria-label="Reset"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
              <button
                onClick={handleCheck}
                disabled={
                  isProxyPolicySource ||
                  !editorPath.trim() ||
                  checkPath.isPending ||
                  savePath.isPending
                }
                className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                {checkPath.isPending ? "Checking…" : "Validate"}
              </button>
              <button
                onClick={handleSave}
                disabled={
                  isProxyPolicySource ||
                  savePath.isPending ||
                  checkPath.isPending ||
                  !isDirty ||
                  checked?.exists === false
                }
                className="shrink-0 flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {savePath.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Validation result */}
          {checked !== null && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 ${
                checked.exists
                  ? "border-success/20 bg-success/5"
                  : "border-destructive/20 bg-destructive/5"
              }`}
            >
              {checked.exists ? (
                <>
                  <Check
                    size={12}
                    className="shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <p className="text-[11px] text-success font-medium">
                    File found
                    {checked.sizeBytes != null && (
                      <span className="ml-1.5 font-normal opacity-70">
                        · {(checked.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle
                    size={12}
                    className="shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <p className="text-[11px] text-destructive font-medium">
                    File not found at this path — check the path and try again
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border/50 bg-muted/10 px-5 py-2">
          <p className="text-[10px] text-muted-foreground/40">
            The proxy hot-reloads <code className="font-mono">policy.yaml</code>{" "}
            on every change — no restart needed.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Engine tab */
function EngineTab() {
  const trpc = useTRPC();

  const urls = useQuery(trpc.proxy.getUrls.queryOptions());
  const engineHealth = useQuery(
    trpc.proxy.engineHealth.queryOptions(undefined, {
      refetchInterval: 20_000,
    }),
  );
  const checkUrl = useMutation(trpc.proxy.checkUrl.mutationOptions());
  const saveEngineUrl = useMutation(
    trpc.proxy.saveEngineUrl.mutationOptions(),
  );
  const resetEngineUrl = useMutation(
    trpc.proxy.resetEngineUrl.mutationOptions(),
  );

  const [engineUrl, setEngineUrl] = useState<string | null>(null);
  const [checkedUrl, setCheckedUrl] = useState<{
    online: boolean;
    latencyMs: number | null;
  } | null>(null);

  const remoteEngineUrl = urls.data?.engineUrl ?? "";
  useEffect(() => {
    if (engineUrl === null && urls.status === "success") {
      setEngineUrl(remoteEngineUrl);
    }
  }, [engineUrl, remoteEngineUrl, urls.status]);

  const editorEngineUrl = engineUrl ?? remoteEngineUrl;
  const isEngineDirty =
    engineUrl !== null && editorEngineUrl.trim() !== remoteEngineUrl.trim();

  async function handleCheckEngineUrl() {
    const trimmedUrl = editorEngineUrl.trim();
    if (!trimmedUrl) {
      toast.error("Detection engine URL is required");
      return;
    }

    setCheckedUrl(null);
    try {
      const result = await checkUrl.mutateAsync({
        url: trimmedUrl,
        healthPath: "/health",
      });
      setCheckedUrl(result);
      if (!result.online) {
        toast.warning("Detection engine health check failed");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to validate engine URL"));
    }
  }

  async function handleSaveEngineUrl() {
    const trimmedUrl = editorEngineUrl.trim();
    if (!trimmedUrl) {
      toast.error("Detection engine URL is required");
      return;
    }

    try {
      await saveEngineUrl.mutateAsync({ url: trimmedUrl });
      toast.success("Detection engine URL saved");
      setEngineUrl(null);
      setCheckedUrl(null);
      await Promise.all([urls.refetch(), engineHealth.refetch()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save engine URL"));
    }
  }

  async function handleResetEngineUrl() {
    try {
      await resetEngineUrl.mutateAsync();
      toast.success("Detection engine URL override cleared");
      setEngineUrl(null);
      setCheckedUrl(null);
      await Promise.all([urls.refetch(), engineHealth.refetch()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reset engine URL"));
    }
  }

  const isRefreshing =
    engineHealth.isFetching || urls.isFetching || checkUrl.isPending;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            urls.refetch();
            engineHealth.refetch();
            setCheckedUrl(null);
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
      </div>

      {/* Detection Engine status card */}
      <div className="rounded-lg border border-border bg-card px-4 py-3.5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold text-foreground">
            Detection Engine
          </p>
          {engineHealth.isPending ? (
            <Sk className="h-5 w-14 rounded-full" />
          ) : (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                engineHealth.data?.online
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${engineHealth.data?.online ? "bg-success motion-safe:animate-pulse" : "bg-destructive"}`}
                aria-hidden="true"
              />
              {engineHealth.data?.online ? "Online" : "Offline"}
            </span>
          )}
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground/60 break-all">
          {engineHealth.data?.url ?? "Not configured"}
        </p>
        {engineHealth.data?.latencyMs != null && (
          <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/40">
            {engineHealth.data.latencyMs}ms
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              size={13}
              className="text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Detection Service URL
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                Base URL used by the dashboard to reach the detection service
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {urls.isPending ? (
            <Sk className="h-4 w-64" />
          ) : (
            <div className="space-y-1 text-[10px] text-muted-foreground/60">
              <p className="font-mono break-all">Current: {urls.data?.engineUrl ?? "—"}</p>
              <p>Deployment URL is used when no override is set.</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Update detection URL
            </label>
            <div className="flex items-center gap-2">
              <input
                value={editorEngineUrl}
                onChange={(e) => {
                  setEngineUrl(e.target.value);
                  setCheckedUrl(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCheckEngineUrl()}
                placeholder="https://engine.your-domain.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                spellCheck={false}
              />
              <button
                onClick={handleCheckEngineUrl}
                disabled={
                  !editorEngineUrl.trim() ||
                  checkUrl.isPending ||
                  saveEngineUrl.isPending ||
                  resetEngineUrl.isPending
                }
                className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                {checkUrl.isPending ? "Checking..." : "Validate"}
              </button>
              <button
                onClick={handleSaveEngineUrl}
                disabled={
                  saveEngineUrl.isPending ||
                  checkUrl.isPending ||
                  resetEngineUrl.isPending ||
                  !isEngineDirty
                }
                className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saveEngineUrl.isPending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleResetEngineUrl}
                disabled={
                  resetEngineUrl.isPending ||
                  saveEngineUrl.isPending ||
                  checkUrl.isPending
                }
                className="shrink-0 flex items-center gap-1 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <RotateCcw size={11} aria-hidden="true" />
                Clear
              </button>
            </div>
          </div>

          {checkedUrl !== null && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 ${
                checkedUrl.online
                  ? "border-success/20 bg-success/5"
                  : "border-destructive/20 bg-destructive/5"
              }`}
            >
              {checkedUrl.online ? (
                <>
                  <Check size={12} className="shrink-0 text-success" aria-hidden="true" />
                  <p className="text-[11px] text-success font-medium">
                    Service reachable
                    {checkedUrl.latencyMs != null && (
                      <span className="ml-1.5 font-normal opacity-70">
                        · {checkedUrl.latencyMs}ms
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle
                    size={12}
                    className="shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <p className="text-[11px] text-destructive font-medium">
                    Could not reach the detection health endpoint
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Engine controls placeholder */}
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-secondary border border-border">
          <SlidersHorizontal size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Engine Configuration
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Threshold tuning and anonymization controls are coming soon.
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

/* Page */
type Tab = "proxy" | "engine";

function ConfigPage() {
  const [tab, setTab] = useState<Tab>("proxy");

  const tabs: { id: Tab; label: string; Icon: typeof Server }[] = [
    { id: "proxy", label: "Proxy", Icon: Server },
    { id: "engine", label: "Detection Engine", Icon: SlidersHorizontal },
  ];

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex h-[52px] items-center px-6">
          <h1 className="text-sm font-semibold text-foreground">
            Configuration
          </h1>
        </div>
        {/* Tab bar */}
        <div className="flex items-center gap-0 px-6">
          {tabs.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={12} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl p-6">
        {tab === "proxy" && <ProxyTab />}
        {tab === "engine" && <EngineTab />}
      </div>
    </div>
  );
}
