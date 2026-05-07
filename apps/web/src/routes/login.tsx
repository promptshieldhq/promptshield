import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { getUser } from "@/functions/get-user";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    try {
      const session = await getUser();
      if (session) throw redirect({ to: "/dashboard" });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        ("isRedirect" in err || "_isRedirect" in err)
      )
        throw err;
      // Server unreachable → just show the login page
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const features = [
    "PII detection across 30+ entity types",
    "Secrets: API keys, tokens, credentials",
    "Policy-as-code via YAML",
    "Self-hosted: prompts never leave your infra",
  ];

  return (
    <div className="relative flex min-h-screen bg-[var(--dev-bg)]">
      {/* Background grid + glow */}
      <div className="pointer-events-none absolute inset-0 dev-grid opacity-50" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] dev-glow" />

      {/* Left — brand panel */}
      <div className="relative hidden w-[48%] flex-col justify-between border-r border-[var(--dev-border)] px-12 py-10 lg:flex">
        <div className="mono flex items-center gap-1.5 text-[13px] font-semibold">
          <span style={{ color: "var(--dev-accent)" }}>$</span>
          <span style={{ color: "var(--dev-text)" }}>prompt</span>
          <span style={{ color: "var(--dev-text-mute)" }}>/shield</span>
        </div>

        <div className="space-y-7">
          <div
            className="mono inline-flex items-center gap-2 rounded px-2.5 py-1 text-[11px] uppercase tracking-widest"
            style={{
              backgroundColor: "rgba(122,162,255,0.10)",
              color: "var(--dev-accent-hi)",
              border: "1px solid rgba(122,162,255,0.20)",
            }}
          >
            <span style={{ color: "var(--dev-accent)" }}>●</span> v0.1.0 ·
            public beta
          </div>

          <h1
            className="text-4xl font-bold leading-tight tracking-tight md:text-5xl"
            style={{ color: "var(--dev-text)" }}
          >
            Secure every LLM
            <br />
            request before it
            <br />
            leaves{" "}
            <span style={{ color: "var(--dev-accent)" }}>
              your infra.
            </span>
          </h1>

          <p
            className="max-w-md text-base leading-relaxed"
            style={{ color: "var(--dev-text-dim)" }}
          >
            Drop-in security gateway for OpenAI, Anthropic, Gemini and others providers. Detects
            PII, secrets, and prompt injection with zero code changes.
          </p>

          <ul className="space-y-2.5">
            {features.map((f) => (
              <li
                key={f}
                className="mono flex items-start gap-3 text-[12px]"
                style={{ color: "var(--dev-text-dim)" }}
              >
                <span
                  className="mt-[3px] shrink-0"
                  style={{ color: "var(--dev-green)" }}
                >
                  ▸
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="mono flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"
          style={{ color: "var(--dev-text-mute)" }}
        >
          <span>{"// MIT License"}</span>
          <span style={{ color: "var(--dev-border-hi)" }}>·</span>
          <span>open source</span>
          <span style={{ color: "var(--dev-border-hi)" }}>·</span>
          <span>self-hostable</span>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-7">
          {/* Mobile wordmark */}
          <div className="mono flex items-center gap-1.5 text-[13px] font-semibold lg:hidden">
            <span style={{ color: "var(--dev-accent)" }}>$</span>
            <span style={{ color: "var(--dev-text)" }}>prompt</span>
            <span style={{ color: "var(--dev-text-mute)" }}>/shield</span>
          </div>

          <div className="space-y-1.5">
            <p
              className="mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--dev-text-mute)" }}
            >
              {mode === "signin" ? "# auth/signin" : "# auth/signup"}
            </p>
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--dev-text)" }}
            >
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p
              className="mono text-[12px]"
              style={{ color: "var(--dev-text-dim)" }}
            >
              <span style={{ color: "var(--dev-accent)" }}>$</span>{" "}
              {mode === "signin"
                ? "ps auth login"
                : "ps auth register --new"}
            </p>
          </div>

          {mode === "signin" ? (
            <SignInForm onSwitchToSignUp={() => setMode("signup")} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setMode("signin")} />
          )}
        </div>
      </div>
    </div>
  );
}
