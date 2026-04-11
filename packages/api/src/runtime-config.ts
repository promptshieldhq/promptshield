import { readFile, writeFile } from "fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import { env } from "@promptshield/env/server";

const CONFIG_PATH = join(process.cwd(), ".ps-config.json");
const DEFAULT_POLICY_PATH = resolve(env.POLICY_FILE_PATH);

function splitAllowedDirs(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => resolve(entry));
}

const ALLOWED_POLICY_DIRS = Array.from(
  new Set([
    dirname(DEFAULT_POLICY_PATH),
    ...splitAllowedDirs(env.POLICY_ALLOWED_DIRS),
  ]),
);

function hasUnsafePathChars(pathValue: string): boolean {
  return (
    pathValue.includes("\0") ||
    pathValue.includes("\n") ||
    pathValue.includes("\r")
  );
}

function isWithin(baseDir: string, targetPath: string): boolean {
  const rel = relative(baseDir, targetPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function normalizePolicyPath(inputPath: string): string | null {
  const trimmed = inputPath.trim();
  if (!trimmed || hasUnsafePathChars(trimmed)) return null;

  const resolved = resolve(trimmed);
  const allowed = ALLOWED_POLICY_DIRS.some((dir) => isWithin(dir, resolved));
  if (!allowed) return null;

  return resolved;
}

interface RuntimeConfig {
  policyFilePath?: string;
  proxyUrl?: string;
  engineUrl?: string;
}

export async function readRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as RuntimeConfig;
  } catch {
    return {};
  }
}

export async function writeRuntimeConfig(patch: Partial<RuntimeConfig>) {
  const existing = await readRuntimeConfig();
  await writeFile(
    CONFIG_PATH,
    JSON.stringify({ ...existing, ...patch }, null, 2),
    "utf-8",
  );
}

export async function deleteRuntimeConfigKey(key: keyof RuntimeConfig) {
  const existing = await readRuntimeConfig();
  delete existing[key];
  await writeFile(CONFIG_PATH, JSON.stringify(existing, null, 2), "utf-8");
}

export async function getEffectivePolicyPath(): Promise<string> {
  const cfg = await readRuntimeConfig();
  const fromRuntime = cfg.policyFilePath
    ? normalizePolicyPath(cfg.policyFilePath)
    : null;
  if (fromRuntime) return fromRuntime;

  const fallback = normalizePolicyPath(DEFAULT_POLICY_PATH);
  return fallback ?? DEFAULT_POLICY_PATH;
}

export async function getEffectiveProxyUrl(): Promise<string> {
  const cfg = await readRuntimeConfig();
  return cfg.proxyUrl ?? env.PROXY_URL;
}

export async function getEffectiveEngineUrl(): Promise<string> {
  const cfg = await readRuntimeConfig();
  return cfg.engineUrl ?? env.ENGINE_URL;
}
