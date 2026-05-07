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
  cmd: string;
  icon: ElementType;
  soon?: boolean;
};

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "overview",
    items: [
      {
        to: "/dashboard",
        label: "dashboard",
        cmd: "dash",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "security",
    items: [
      { to: "/policy", label: "policy", cmd: "policy", icon: ShieldCheck },
      { to: "/audit", label: "audit", cmd: "audit", icon: ScrollText },
    ],
  },
  {
    label: "system",
    items: [
      {
        to: "/config",
        label: "config",
        cmd: "config",
        icon: SlidersHorizontal,
      },
    ],
  },
];

function NavLink({ item }: { item: NavItem }) {
  const { to, label, icon: Icon, soon } = item;

  if (soon) {
    return (
      <div className="mono flex items-center gap-2.5 rounded px-3 py-1.5 text-[12px] text-[var(--dev-text-mute)]/60 cursor-not-allowed select-none">
        <Icon size={12} className="shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        <span className="mono shrink-0 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[var(--dev-text-mute)]/70">
          soon
        </span>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="mono group flex items-center gap-2.5 rounded px-3 py-1.5 text-[12px] text-[var(--dev-text-dim)] border border-transparent transition-colors hover:bg-[var(--dev-panel)] hover:text-[var(--dev-text)]"
      activeProps={{
        className:
          "mono group flex items-center gap-2.5 rounded px-3 py-1.5 text-[12px] text-[var(--dev-text)] bg-[rgba(122,162,255,0.10)] border border-[rgba(122,162,255,0.25)] is-active",
      }}
    >
      <Icon
        size={12}
        className="shrink-0 text-[var(--dev-text-mute)] group-[.is-active]:text-[var(--dev-accent)]"
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function LayoutComponent() {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--dev-bg)]">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--dev-border)] bg-[var(--sidebar)]">
        {/* Wordmark — terminal prompt */}
        <div className="flex h-[52px] items-center border-b border-[var(--dev-border)] px-4">
          <Link
            to="/dashboard"
            className="mono flex items-center gap-1.5 text-[13px] font-semibold tracking-tight"
          >
            <span style={{ color: "var(--dev-accent)" }}>$</span>
            <span style={{ color: "var(--dev-text)" }}>prompt</span>
            <span style={{ color: "var(--dev-text-mute)" }}>/shield</span>
          </Link>
        </div>

        {/* Nav sections */}
        <nav
          className="flex-1 overflow-y-auto px-2 py-4 space-y-5"
          aria-label="Main navigation"
        >
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="mb-2 flex items-center gap-2 px-3">
                <span className="mono text-[10px] uppercase tracking-widest text-[var(--dev-text-mute)]">
                  # {section.label}
                </span>
                <div className="h-px flex-1 bg-[var(--dev-border)]" />
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom panel */}
        <div className="border-t border-[var(--dev-border)] px-2 py-2 space-y-0.5">
          <NavLink
            item={{
              to: "/settings",
              label: "settings",
              cmd: "settings",
              icon: Settings,
            }}
          />
          <UserMenu />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[var(--dev-bg)]">
        <Outlet />
      </main>
    </div>
  );
}
