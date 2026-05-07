import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

const inputClass =
  "mono w-full rounded border border-[var(--dev-border)] bg-[var(--dev-panel)] px-3.5 py-2.5 text-[13px] text-[var(--dev-text)] placeholder:text-[var(--dev-text-mute)] transition-colors focus:outline-none focus-visible:border-[var(--dev-accent)] focus-visible:ring-1 focus-visible:ring-[var(--dev-accent)]/40";

const labelClass =
  "mono text-[10px] uppercase tracking-widest text-[var(--dev-text-mute)]";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
            toast.success("Signed in");
          },
          onError: (error) => {
            toast.error(error.error.message || "Invalid credentials");
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field
          name="email"
          validators={{ onBlur: z.email("Invalid email address") }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor={field.name} className={labelClass}>
                # email
              </label>
              <input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
              {field.state.meta.errors[0] && (
                <p className="mono text-[11px] text-[var(--destructive)]">
                  {field.state.meta.errors[0]?.message}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onBlur: z.string().min(8, "Password must be at least 8 characters"),
          }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor={field.name} className={labelClass}>
                # password
              </label>
              <div className="relative">
                <input
                  id={field.name}
                  name={field.name}
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dev-text-mute)] transition-colors hover:text-[var(--dev-text)]"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {field.state.meta.errors[0] && (
                <p className="mono text-[11px] text-[var(--destructive)]">
                  {field.state.meta.errors[0]?.message}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(s) => ({
            canSubmit: s.canSubmit,
            isSubmitting: s.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="mono btn-press w-full rounded px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: "var(--dev-accent)",
                color: "var(--dev-bg)",
              }}
            >
              {isSubmitting ? "signing in…" : "sign in →"}
            </button>
          )}
        </form.Subscribe>
      </form>

      <p
        className="mono text-center text-[12px]"
        style={{ color: "var(--dev-text-dim)" }}
      >
        no account?{" "}
        <button
          onClick={onSwitchToSignUp}
          className="font-medium transition-colors hover:underline"
          style={{ color: "var(--dev-accent-hi)" }}
        >
          register →
        </button>
      </p>
    </div>
  );
}
