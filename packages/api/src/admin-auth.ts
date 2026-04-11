import { TRPCError } from "@trpc/server";

const EMAIL_SEPARATOR = ",";

function splitConfiguredEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(EMAIL_SEPARATOR)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isConfigAdmin(
  session: unknown,
  configuredEmailsRaw: string | undefined,
): boolean {
  const configuredEmails = splitConfiguredEmails(configuredEmailsRaw);
  if (configuredEmails.length === 0) return false;

  const email =
    typeof session === "object" &&
    session !== null &&
    typeof (session as { user?: { email?: unknown } }).user?.email === "string"
      ? (session as { user: { email: string } }).user.email.toLowerCase()
      : "";

  return Boolean(email && configuredEmails.includes(email));
}

export function requireConfigAdmin(
  session: unknown,
  configuredEmailsRaw: string | undefined,
): void {
  const configuredEmails = splitConfiguredEmails(configuredEmailsRaw);
  if (configuredEmails.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "No config admins configured. Set CONFIG_ADMIN_EMAILS to allow configuration changes.",
    });
  }

  if (!isConfigAdmin(session, configuredEmailsRaw)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only configured admins can change proxy or policy settings",
    });
  }
}
