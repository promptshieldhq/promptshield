import type { ElementType } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import { getUser } from "@/functions/get-user";
import UserMenu from "@/components/user-menu";

export const Route = createFileRoute("/_layout")({
  beforeLoad: async () => {
    try {
      const session = await getUser();
      if (!session) throw redirect({ to: "/login" });
      return { session };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        ("isRedirect" in err || "_isRedirect" in err)
      )
        throw err;
      throw redirect({ to: "/login" });
    }
  },
  component: LayoutComponent,
});

type NavItem = {
  to: string;
  label: string;
  icon: ElementType;
  soon?: boolean;
};

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Security",
    items: [
      { to: "/policy", label: "Policy", icon: ShieldCheck },
      { to: "/audit", label: "Audit Log", icon: ScrollText },
    ],
  },
  {
    label: "System",
    items: [{ to: "/config", label: "Configuration", icon: SlidersHorizontal }],
  },
];

function NavLink({ item }: { item: NavItem }) {
  const { to, label, icon: Icon, soon } = item;

  if (soon) {
    return (
      <div className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/35 cursor-not-allowed select-none">
        <Icon size={14} className="shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-border/60 text-muted-foreground/50">
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-100 hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      activeProps={{
        className:
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-foreground bg-accent",
      }}
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function LayoutComponent() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        {/* Wordmark */}
        <div className="flex h-[52px] items-center border-b border-border px-4">
          <span className="text-[13px] font-semibold text-foreground tracking-tight">
            PromptShield
          </span>
        </div>

        {/* Nav sections */}
        <nav
          className="flex-1 overflow-y-auto px-2 py-3 space-y-4"
          aria-label="Main navigation"
        >
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom panel */}
        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <NavLink
            item={{ to: "/settings", label: "Settings", icon: Settings }}
          />
          <UserMenu />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
