import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  Compass,
  Cpu,
  Settings,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MusicMiniPlayer } from "./music-player";
import { user } from "@/lib/wk-data";

const nav = [
  { to: "/", label: "Health", icon: Cpu },
  { to: "/assistant", label: "Assistant", icon: Sparkles },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/navigate", label: "Navigate", icon: Compass },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/notifications", label: "Alerts", icon: Bell },
] as const;

const secondary = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="WK Health home">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-[0.625rem] font-bold tracking-tight text-background"
        aria-hidden="true"
      >
        WK
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm leading-tight font-semibold tracking-tight">
          WK Health
        </span>
        <span className="eyebrow block leading-tight">Health OS</span>
      </span>
    </Link>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Activity;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeOptions={{ exact: to === "/" }}
      activeProps={{ className: "bg-foreground text-background hover:bg-foreground hover:text-background" }}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppShell({
  children,
  title,
  eyebrow,
}: {
  children: ReactNode;
  title: string;
  eyebrow: string;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 border-r border-border bg-surface p-5 lg:flex">
        <Wordmark />
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} {...n} />
          ))}
        </nav>
        <div className="hairline" />
        <nav aria-label="Account" className="flex flex-col gap-1">
          {secondary.map((n) => (
            <NavLink key={n.to} {...n} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <MusicMiniPlayer compact />
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent"
          >
            <span className="numeric grid size-9 shrink-0 place-items-center rounded-full border border-border text-xs">
              {user.initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="eyebrow block">{user.plan}</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <span className="lg:hidden">
                <Wordmark />
              </span>
              <span className="hidden min-w-0 lg:block">
                <p className="eyebrow">{eyebrow}</p>
                <h1 className="display truncate text-xl">{title}</h1>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="relative grid size-11 place-items-center rounded-full border border-border transition-colors hover:bg-accent"
              >
                <Bell className="size-4" aria-hidden="true" />
                <span className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-signal" aria-hidden="true" />
              </Link>
              <Link
                to="/settings"
                aria-label="Settings"
                className="grid size-11 place-items-center rounded-full border border-border transition-colors hover:bg-accent lg:hidden"
              >
                <Settings className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pt-8 pb-40 sm:px-8 lg:pb-16">
          <div className="mb-8 lg:hidden">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display mt-1 text-3xl">{title}</h1>
          </div>
          {children}
        </main>

        <footer className="hidden border-t border-border px-8 py-6 lg:block">
          <p className="eyebrow">WK Health — design prototype · monochrome system v1</p>
        </footer>
      </div>

      {/* Mobile dock */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="px-3 pb-3">
          <MusicMiniPlayer className="mb-2 shadow-float" />
          <nav
            aria-label="Primary"
            className="panel grid grid-cols-6 gap-1 p-1.5 shadow-float"
          >
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                aria-label={label}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "bg-foreground text-background" }}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-md py-1.5 text-muted-foreground transition-colors",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="text-[0.5625rem] tracking-wide uppercase">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
