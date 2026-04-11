// DEV ONLY — creates a default admin account for local development.
// Never run this against a production database.
import "dotenv/config";
import { auth } from "@promptshield/auth";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

async function seed() {
  console.log("Seeding default admin user...");

  try {
    await auth.api.signUpEmail({
      body: {
        name: "Admin",
        email: "admin@admin.com",
        password: "admin1234",
      },
    });
    console.log("✓ Created default user");
    console.log("  Email:    admin@admin.com");
    console.log("  Password: admin1234");
  } catch (e: unknown) {
    const message = getErrorMessage(e);
    const status = getErrorStatus(e);

    if (message.includes("already exists") || status === 422) {
      console.log("✓ Admin user already exists");
    } else {
      console.error("Failed to create admin user:", message);
    }
  }

  process.exit(0);
}

seed();
