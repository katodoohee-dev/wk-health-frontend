import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, Bell, Compass, Cpu, LayoutGrid, Loader2, Settings, Sparkles, User, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MusicProvider } from "@/lib/music";
import { MiniPlayer } from "@/components/app/mini-player";

const nav = [
  { to: "/", label: "Health", icon: Cpu },
  { to: "/assistant", label: "Assistant", icon: Sparkles },
  { to: "/pedometer", label: "Activity", icon: Activity },
  { to: "/navigate", label: "Navigate", icon: Compass },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/notifications", label: "Alerts", icon: Bell },
] as const;
const secondary = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/reference", label: "State library", icon: LayoutGrid },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const titles: Record<string, [string, string]> = {
  "/": ["Wednesday · 19 August", "Health overview"],
  "/assistant": ["Conversation", "WK Copilot"],
  "/pedometer": ["Movement intelligence", "Movement"],
  "/navigate": ["Guidance", "Navigate"],
  "/friends": ["Social layer", "Friends"],
  "/notifications": ["Timeline", "Notifications"],
  "/profile": ["Account", "Profile"],
  "/settings": ["Configuration", "Settings"],
  "/reference": ["Design system", "State library"],
};

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="WK Health home">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-[0.625rem] font-bold tracking-tight text-background" aria-hidden="true">WK</span>
      <span className="min-w-0">
        <span className="block truncate text-sm leading-tight font-semibold tracking-tight">WK Health</span>
        <span className="eyebrow block leading-tight">Health OS</span>
      </span>
    </Link>
  );
}
function NavLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Activity }) {
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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { ready, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const isAuthRoute = pathname === "/auth";
  useEffect(() => {
    if (ready && !isAuthenticated && !isAuthRoute) void navigate({ to: "/auth", replace: true });
  }, [ready, isAuthenticated, isAuthRoute, navigate]);
  const gated = !isAuthRoute && (!ready || !isAuthenticated);
  const [eyebrow, title] = titles[pathname] ?? ["WK Health", pathname === "/" ? "Health overview" : pathname.replace("/", "").replaceAll("-", " ")];

  return (
    <MusicProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[268px_minmax(0,1fr)]" data-wk-route={pathname}>
        <aside className="sticky top-0 hidden h-screen flex-col gap-8 border-r border-border bg-surface p-5 lg:flex">
          <Wordmark />
          <nav aria-label="Primary" className="flex flex-col gap-1">{nav.map((n) => <NavLink key={n.to} {...n} />)}</nav>
          <div className="hairline" />
          <nav aria-label="Account" className="flex flex-col gap-1">{secondary.map((n) => <NavLink key={n.to} {...n} />)}</nav>
          <div className="mt-auto flex flex-col gap-4">
            <MiniPlayer />
            <Link to="/profile" className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent">
              <span className="numeric grid size-9 shrink-0 place-items-center rounded-full border border-border text-xs">{(user?.name ?? "WK").slice(0,2).toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{user?.name ?? user?.email ?? "WK Health"}</span>
                <span className="eyebrow block">Personal health system</span>
              </span>
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
            <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:px-8">
              <div className="flex min-w-0 items-center gap-4">
                <span className="lg:hidden"><Wordmark /></span>
                <span className="hidden min-w-0 lg:block"><p className="eyebrow">{eyebrow}</p><h1 className="display truncate text-xl">{title}</h1></span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link to="/notifications" aria-label="Notifications" className="relative grid size-11 place-items-center rounded-full border border-border transition-colors hover:bg-accent"><Bell className="size-4" aria-hidden="true" /><span className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-foreground" aria-hidden="true" /></Link>
                <Link to="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full border border-border transition-colors hover:bg-accent lg:hidden"><Settings className="size-4" aria-hidden="true" /></Link>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pt-8 pb-40 sm:px-8 lg:pb-16">
            {gated ? (
              <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
                <span className="panel flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />กำลังตรวจสอบการเข้าสู่ระบบ…</span>
                <p className="max-w-xs text-xs text-muted-foreground">กำลังเชื่อมต่อเซิร์ฟเวอร์</p>
              </div>
            ) : children}
          </main>
          <footer className="hidden border-t border-border px-8 py-6 lg:block"><p className="eyebrow">WK Health — Health OS · monochrome editorial system</p></footer>
        </div>

        {!isAuthRoute && isAuthenticated && (
          <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
            <div className="px-3 pb-3">
              <MiniPlayer />
              <nav aria-label="Primary" className="panel grid grid-cols-6 gap-1 p-1.5 shadow-glow">
                {nav.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} aria-label={label} activeOptions={{ exact: to === "/" }} activeProps={{ className: "bg-foreground text-background" }} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md py-1.5 text-muted-foreground transition-colors">
                    <Icon className="size-4" aria-hidden="true" /><span className="text-[0.5625rem] tracking-wide uppercase">{label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}
      </div>
    </MusicProvider>
  );
}
