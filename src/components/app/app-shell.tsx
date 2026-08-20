import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, BarChart3, Bell, BookOpen, Bot, Home, Loader2, ScanLine, Settings, UserRound, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MusicProvider } from "@/lib/music";
import { MiniPlayer } from "@/components/app/mini-player";

const primary = [
  { to: "/", label: "Health", icon: Home },
  { to: "/stats", label: "Health data", icon: BarChart3 },
  { to: "/assistant", label: "WK Assistant", icon: Bot },
  { to: "/pedometer", label: "Activity", icon: Activity },
  { to: "/diary", label: "Nutrition", icon: BookOpen },
] as const;
const secondary = [
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Wordmark() {
  return <Link to="/" className="flex items-center gap-3" aria-label="WK Health home"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground text-[10px] font-bold tracking-tight text-background">WK</span><span className="min-w-0"><span className="block text-sm font-semibold tracking-tight">WK Health</span><span className="eyebrow block">Health OS</span></span></Link>;
}
function DesktopItem({ to, label, icon: Icon, active }: { to: string; label: string; icon: typeof Home; active: boolean }) {
  return <Link to={to} aria-current={active ? "page" : undefined} className={`press flex min-h-11 items-center gap-3 rounded-md px-3 text-sm ${active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon className="size-4 shrink-0"/><span className="truncate">{label}</span></Link>;
}
function MobileItem({ to, label, icon: Icon, active }: { to: string; label: string; icon: typeof Home; active: boolean }) {
  return <Link to={to} aria-label={label} aria-current={active ? "page" : undefined} className={`press flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md py-1.5 ${active ? "bg-foreground text-background" : "text-muted-foreground"}`}><Icon className="size-4"/><span className="max-w-full truncate px-1 text-[9px] uppercase tracking-wide">{label}</span></Link>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { ready, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isAuthRoute = pathname === "/auth";
  useEffect(() => { if (ready && !isAuthenticated && !isAuthRoute) void navigate({ to: "/auth", replace: true }); }, [ready, isAuthenticated, isAuthRoute, navigate]);
  const gated = !isAuthRoute && (!ready || !isAuthenticated);

  return <MusicProvider><div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]" data-wk-route={pathname}>
    <aside className="sticky top-0 hidden h-screen flex-col gap-7 border-r border-border bg-surface p-5 lg:flex">
      <Wordmark/>
      <nav aria-label="Primary" className="flex flex-col gap-1">{primary.map(n=><DesktopItem key={n.to} {...n} active={pathname===n.to}/>)}</nav>
      <div className="hairline"/>
      <nav aria-label="Secondary" className="flex flex-col gap-1">{secondary.map(n=><DesktopItem key={n.to} {...n} active={pathname===n.to}/>)}</nav>
      <div className="mt-auto flex flex-col gap-3"><MiniPlayer/><p className="eyebrow px-1">Personal health system</p></div>
    </aside>

    <div className="flex min-w-0 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md"><div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-5 py-4 sm:px-8"><div className="lg:hidden"><Wordmark/></div><div className="hidden min-w-0 lg:block"><p className="eyebrow">{pathname === "/assistant" ? "Conversation" : pathname === "/stats" ? "Health intelligence" : pathname === "/pedometer" ? "Movement" : "WK Health"}</p><h1 className="display mt-1 truncate text-xl">{pathname === "/" ? "Health overview" : pathname.replace("/", "").replaceAll("-", " ")}</h1></div><div className="flex items-center gap-2"><Link to="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full border border-border hover:bg-accent"><Settings className="size-4"/></Link><Link to="/friends" aria-label="Friends" className="hidden size-11 place-items-center rounded-full border border-border hover:bg-accent sm:grid"><Users className="size-4"/></Link><Link to="/profile" aria-label="Profile" className="grid size-11 place-items-center rounded-full border border-border hover:bg-accent"><UserRound className="size-4"/></Link></div></div></header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-36 pt-8 sm:px-8 lg:pb-16">
        {gated ? <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center"><span className="panel flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>กำลังตรวจสอบการเข้าสู่ระบบ…</span><p className="max-w-sm text-xs text-muted-foreground">กำลังเชื่อมต่อเซิร์ฟเวอร์</p></div> : children}
      </main>
    </div>

    {!isAuthRoute && isAuthenticated && <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden"><div className="px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]"><MiniPlayer/><div className="panel mx-auto mt-2 grid max-w-md grid-cols-5 gap-1 p-1.5 shadow-glow">{primary.map(n=><MobileItem key={n.to} {...n} active={pathname===n.to}/>)}</div></div></nav>}
  </div></MusicProvider>;
}
