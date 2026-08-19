import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Home, Loader2, ScanLine } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MusicProvider } from "@/lib/music";
import { MiniPlayer } from "@/components/app/mini-player";
import { apiMe } from "@/lib/api";
import { VoiceControlAdvanced as VoiceControl } from "@/components/VoiceControlAdvanced";
import { NavigationOverlayLoader } from "@/components/NavigationOverlayLoader";
import { AppCommandRuntimeLoader } from "@/components/AppCommandRuntimeLoader";
import "@/components/voice-control.css";
import { gpsBridge } from "@/lib/gps-bridge";

const tabs = [
  { to: "/", label: "หน้าแรก", icon: Home },
  { to: "/diary", label: "ไดอารี", icon: BookOpen },
] as const;

function AmbientLayer() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="wk-grid absolute inset-0 opacity-[0.025]" />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid size-9 place-items-center rounded-xl bg-foreground text-background" aria-hidden>
        <span className="font-display text-sm font-semibold tracking-[-0.08em]">WK</span>
      </div>
      <div className="leading-none">
        <div className="font-display text-sm font-semibold tracking-[-0.03em]">WK Health</div>
        <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Health OS</div>
      </div>
    </div>
  );
}

function DesktopNav({ pathname }: { pathname: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[224px] border-r border-hairline bg-background/90 px-5 py-6 backdrop-blur-xl lg:flex lg:flex-col">
      <Brand />
      <div className="mt-10 space-y-1">
        {tabs.map((t) => <NavItem key={t.to} {...t} active={pathname === t.to} desktop />)}
        <NavItem to="/scan" label="สแกน" icon={ScanLine} active={pathname === "/scan"} desktop />
      </div>
      <div className="mt-auto px-2 text-[10px] leading-relaxed text-muted-foreground">
        <span className="block font-medium text-foreground">Personal health system</span>
        สุขภาพ โภชนาการ การเคลื่อนไหว และ AI ในประสบการณ์เดียว
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { ready, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isAuthRoute = pathname === "/auth";
  useEffect(() => { if (ready && !isAuthenticated && !isAuthRoute) void navigate({ to: "/auth", replace: true }); }, [ready, isAuthenticated, isAuthRoute, navigate]);
  const gated = !isAuthRoute && (!ready || !isAuthenticated);
  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, enabled: isAuthenticated });

  return (
    <MusicProvider>
      <div className="relative min-h-screen w-full">
        <AmbientLayer />
        {!isAuthRoute && isAuthenticated && <DesktopNav pathname={pathname} />}
        <main className={!isAuthRoute && isAuthenticated ? "lg:pl-[224px]" : ""}>
          <div className="mx-auto w-full max-w-2xl px-4 pb-32 sm:px-6 lg:max-w-6xl lg:px-10 lg:pb-16 xl:max-w-7xl">
            {!isAuthRoute && isAuthenticated && (
              <header className="sticky top-0 z-20 -mx-4 mb-5 flex h-14 items-center justify-between border-b border-hairline bg-background/85 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
                <Brand />
              </header>
            )}
            {gated ? (
              <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
                <span className="glass-strong flex items-center gap-2 rounded-2xl px-5 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  กำลังตรวจสอบการเข้าสู่ระบบ…
                </span>
                <p className="max-w-xs text-xs text-muted-foreground">กำลังเชื่อมต่อเซิร์ฟเวอร์ อาจใช้เวลาสักครู่สำหรับคำขอแรก</p>
              </div>
            ) : children}
          </div>
        </main>

        {!isAuthRoute && isAuthenticated && <>
          <VoiceControl
            profileName={me.data?.["name"] as string | undefined}
            bodyWeightKg={Number(me.data?.["weightKg"] ?? 60)}
            onExercise={(result) => window.dispatchEvent(new CustomEvent("wk:voice-exercise", { detail: result }))}
            onStartGps={async () => { const ok = await gpsBridge.start(); if (ok) window.dispatchEvent(new CustomEvent("wk:gps-started")); if (!ok) void navigate({ to: "/pedometer" }); }}
            onStopGps={async () => { await gpsBridge.stop(); }}
            onOpenProfileModal={() => void navigate({ to: "/profile" })}
          />
          <NavigationOverlayLoader />
          <AppCommandRuntimeLoader />
        </>}

        {!isAuthRoute && isAuthenticated && <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <MiniPlayer />
          <div className="mx-auto mb-3 w-full max-w-md px-4">
            <div className="relative grid grid-cols-3 items-center rounded-[1.5rem] border border-hairline bg-background/92 px-2 py-2 shadow-soft backdrop-blur-xl">
              {tabs.map((t) => <NavItem key={t.to} {...t} active={pathname === t.to} />)}
              <div className="relative grid place-items-center">
                <Link to="/scan" aria-label="สแกนอาหาร" className="press absolute -top-9 grid size-16 place-items-center rounded-[1.25rem] bg-foreground text-background shadow-soft">
                  <ScanLine className="size-6" />
                </Link>
                <span className="mt-6 text-[10px] font-medium text-muted-foreground">สแกน</span>
              </div>
            </div>
          </div>
        </nav>}
      </div>
    </MusicProvider>
  );
}

function NavItem({ to, label, icon: Icon, active, desktop = false }: { to: string; label: string; icon: typeof Home; active: boolean; desktop?: boolean }) {
  if (desktop) {
    return <Link to={to} className={`press flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`} aria-current={active ? "page" : undefined}>
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>;
  }
  return <Link to={to} className={`press flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`} aria-current={active ? "page" : undefined}>
    <span className={`grid size-9 place-items-center rounded-xl transition-colors ${active ? "bg-surface-2" : "bg-transparent"}`}><Icon className="size-5" /></span>
    <span className="label-editorial truncate text-inherit">{label}</span>
  </Link>;
}
