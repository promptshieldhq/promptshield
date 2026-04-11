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

  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div className="hidden lg:flex w-[45%] flex-col justify-between bg-foreground px-12 py-10">
        <span className="font-display text-base font-bold tracking-tight text-background">
          PromptShield
        </span>

        <div className="space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight text-background">
            Secure every LLM request.
            <br />
            Before it leaves
            <br />
            your infrastructure.
          </h1>
          <p className="text-base text-background/60 leading-relaxed max-w-sm">
            Drop-in security proxy for OpenAI, Anthropic, and Gemini. Detects
            PII, secrets, and prompt injection — zero code changes required.
          </p>

          <div className="space-y-3 pt-2">
            {[
              "PII detection across 30+ entity types",
              "Secrets detection — API keys, tokens, credentials",
              "Policy-as-code via YAML",
              "Self-hosted — prompts never leave your infra",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-sm text-background/70">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-background/30">MIT License · Open Source</p>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile wordmark */}
          <span className="block font-display text-base font-bold tracking-tight text-foreground lg:hidden">
            PromptShield
          </span>

          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to your dashboard"
                : "Start securing your LLM requests"}
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
