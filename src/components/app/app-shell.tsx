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

function Aurora() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="absolute inset-0 bg-background" /><div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,var(--foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--foreground)_1px,transparent_1px)] [background-size:56px_56px]" /></div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { ready, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isAuthRoute = pathname === "/auth";
  useEffect(() => { if (ready && !isAuthenticated && !isAuthRoute) void navigate({ to: "/auth", replace: true }); }, [ready, isAuthenticated, isAuthRoute, navigate]);
  const gated = !isAuthRoute && (!ready || !isAuthenticated);
  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, enabled: isAuthenticated });
  return <MusicProvider><div className="relative min-h-screen w-full"><Aurora /><div className="mx-auto w-full max-w-2xl px-4 pb-32 lg:max-w-5xl">{gated ? <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center"><span className="glass-strong flex items-center gap-2 rounded-3xl px-5 py-4 text-sm text-muted-foreground shadow-soft"><Loader2 className="size-4 animate-spin text-primary" /> กำลังตรวจสอบการเข้าสู่ระบบ…</span><p className="max-w-xs text-xs text-muted-foreground">กำลังเชื่อมต่อเซิร์ฟเวอร์ อาจใช้เวลาสักครู่สำหรับคำขอแรก</p></div> : children}</div>
  {!isAuthRoute && isAuthenticated && <><VoiceControl profileName={me.data?.["name"] as string | undefined} bodyWeightKg={Number(me.data?.["weightKg"] ?? 60)} onExercise={(result) => window.dispatchEvent(new CustomEvent("wk:voice-exercise", { detail: result }))} onStartGps={async () => { const ok = await gpsBridge.start(); if (ok) window.dispatchEvent(new CustomEvent("wk:gps-started")); if (!ok) void navigate({ to: "/pedometer" }); }} onStopGps={async () => { await gpsBridge.stop(); }} onOpenProfileModal={() => void navigate({ to: "/profile" })} /><NavigationOverlayLoader /><AppCommandRuntimeLoader /></>}
  {!isAuthRoute && isAuthenticated && <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"><MiniPlayer /><div className="mx-auto mb-3 w-full max-w-md px-4"><div className="hairline-t relative grid grid-cols-3 items-center rounded-[1.75rem] border border-hairline bg-background/90 px-2 py-2 backdrop-blur-xl">{tabs.map((t) => <NavItem key={t.to} {...t} active={pathname === t.to} />)}<div className="relative grid place-items-center"><Link to="/scan" aria-label="สแกนอาหาร" className="press absolute -top-9 grid size-16 place-items-center rounded-[1.35rem] bg-foreground text-background"><ScanLine className="size-7" /></Link><span className="mt-6 text-[10px] font-medium text-muted-foreground">สแกน</span></div></div></div></nav>}</div></MusicProvider>;
}
function NavItem({ to, label, icon: Icon, active }: { to: string; label: string; icon: typeof Home; active: boolean }) { return <Link to={to} className={`press flex flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}><span className={`grid size-9 place-items-center rounded-xl transition-colors ${active ? "bg-surface-2" : "bg-transparent"}`}><Icon className="size-5" /></span><span className="label-editorial truncate text-inherit">{label}</span></Link>; }
