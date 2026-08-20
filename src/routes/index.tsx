import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Footprints, LogOut, MessageSquareHeart, Wallet, Dumbbell, Music2,
  UserRound, Plus, Snowflake, Image as ImageIcon, Users, Download,
  BellRing, ScanLine, Watch, ArrowUpRight, Droplets, Flame, Target,
} from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiCheckin, apiCheckinToday, apiDiary, apiPedometerToday, apiStatsToday, todayISO } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WK Health — Health OS" },
      { name: "description", content: "แดชบอร์ดสุขภาพแบบใหม่ของ WK Health พร้อมข้อมูลจริงจาก API" },
    ],
  }),
  component: Home,
});

const tools = [
  { to: "/scan", icon: ScanLine, title: "สแกนอาหาร", desc: "AI calorie scan", tone: "mint" },
  { to: "/pedometer", icon: Footprints, title: "ออกวิ่ง", desc: "Live GPS track", tone: "sky" },
  { to: "/mood", icon: MessageSquareHeart, title: "Mood Menu", desc: "เมนูตามอารมณ์", tone: "lilac" },
  { to: "/budget", icon: Wallet, title: "Budget Planner", desc: "วางแผนตามงบ", tone: "peach" },
  { to: "/workout", icon: Dumbbell, title: "Workout", desc: "ตารางฝึก AI", tone: "mint" },
  { to: "/device-connect", icon: Watch, title: "เชื่อมอุปกรณ์", desc: "HealthKit / Fit", tone: "sky" },
  { to: "/gallery", icon: ImageIcon, title: "แกลเลอรี", desc: "รูปอาหารของคุณ", tone: "lilac" },
  { to: "/friends", icon: Users, title: "เพื่อน & Streak", desc: "เชียร์กัน", tone: "peach" },
] as const;

function Home() {
  const { user, logout, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const date = todayISO();
  const stats = useQuery({ queryKey: ["stats", "today"], queryFn: apiStatsToday, enabled: isAuthenticated });
  const ped = useQuery({ queryKey: ["pedometer", "today"], queryFn: apiPedometerToday, enabled: isAuthenticated });
  const diary = useQuery({ queryKey: ["diary", date], queryFn: () => apiDiary(date), enabled: isAuthenticated });
  const checkin = useQuery({ queryKey: ["checkin", "today"], queryFn: apiCheckinToday, enabled: isAuthenticated });
  const doCheckin = useMutation({ mutationFn: apiCheckin, onSuccess: () => void qc.invalidateQueries({ queryKey: ["checkin"] }) });

  const s = stats.data;
  const remaining = s ? s.goal - s.eaten + s.burned : 0;
  const water = s?.water ?? 0;
  const waterGoal = s?.waterGoal ?? 8;

  return (
    <div className="pb-10">
      <header className="flex items-center justify-between py-5">
        <div>
          <div className="label-editorial">WK HEALTH · TODAY</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">สวัสดี {user?.name ?? user?.email ?? "คุณ"} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">พร้อมดูแลสุขภาพของคุณวันนี้หรือยัง?</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/profile" className="glass press grid size-10 place-items-center rounded-2xl shadow-soft"><UserRound className="size-4" /></Link>
          <ThemeToggle />
          <button onClick={() => void logout()} className="glass press grid size-10 place-items-center rounded-2xl shadow-soft" aria-label="ออกจากระบบ"><LogOut className="size-4" /></button>
        </div>
      </header>

      <section className="bg-hero shadow-glow relative overflow-hidden rounded-[2rem] p-6 text-primary-foreground sm:p-8">
        <div className="absolute -right-12 -top-16 size-44 rounded-full bg-white/30 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/35 px-3 py-1 font-mono text-[10px] tracking-widest uppercase">Daily Health OS</span>
            {s?.streak ? <span className="rounded-full bg-white/35 px-3 py-1 font-mono text-[10px]">🔥 {s.streak} day streak</span> : null}
          </div>
          {stats.isLoading || !s ? <Skeleton className="mt-7 h-24 w-full bg-white/25" /> : stats.isError ? <div className="mt-6 rounded-2xl bg-white/40 p-4"><ErrorState error={stats.error} onRetry={() => void stats.refetch()} /></div> : (
            <div className="mt-7">
              <div className="text-sm opacity-80">แคลอรีที่เหลือวันนี้</div>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-7xl font-extrabold leading-none tracking-[-0.06em]">{remaining}</span>
                <span className="pb-2 text-sm font-medium">kcal</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <MiniStat label="กิน" value={`${s.eaten}`} icon={<Flame className="size-3.5" />} />
                <MiniStat label="เผาผลาญ" value={`${s.burned}`} icon={<ArrowUpRight className="size-3.5" />} />
                <MiniStat label="เป้าหมาย" value={`${s.goal}`} icon={<Target className="size-3.5" />} />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link to="/scan" className="bg-mint-gradient shadow-soft press rounded-[1.75rem] p-5 text-primary-foreground">
          <div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-white/30"><ScanLine /></span><ArrowUpRight className="size-4" /></div>
          <h2 className="mt-8 text-xl font-bold">สแกนอาหาร</h2><p className="mt-1 text-sm opacity-80">ถ่ายรูป → AI วิเคราะห์แคลอรี</p>
        </Link>
        <Link to="/pedometer" className="rounded-[1.75rem] bg-sky-soft shadow-soft press p-5 text-secondary-foreground">
          <div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-sky/25"><Footprints /></span><ArrowUpRight className="size-4" /></div>
          <h2 className="mt-8 text-xl font-bold">ออกวิ่ง</h2><p className="mt-1 text-sm opacity-80">GPS จริง · ระยะทาง · ความเร็ว</p>
        </Link>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="glass shadow-soft rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between"><span className="label-editorial">STEPS</span><Footprints className="size-4 text-primary" /></div>
          {ped.isLoading ? <Skeleton className="mt-5 h-12 w-32" /> : ped.isError || !ped.data ? <ErrorState error={ped.error} onRetry={() => void ped.refetch()} /> : <><div className="mt-4 text-4xl font-extrabold tabular-nums">{ped.data.steps.toLocaleString()}</div><p className="mt-2 text-xs text-muted-foreground">เป้า {ped.data.goal.toLocaleString()} · {ped.data.distanceKm} กม.</p></>}
        </div>
        <div className="glass shadow-soft rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between"><span className="label-editorial">WATER</span><Droplets className="size-4 text-signal" /></div>
          <div className="mt-4 text-4xl font-extrabold tabular-nums">{water}<span className="ml-2 text-sm font-medium text-muted-foreground">/ {waterGoal} แก้ว</span></div>
          <div className="mt-4 flex gap-1.5">{Array.from({ length: waterGoal }).map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < water ? "bg-live" : "bg-surface-2"}`} />)}</div>
        </div>
      </section>

      {checkin.data && <button onClick={() => !checkin.data!.alreadyCheckedInToday && doCheckin.mutate()} disabled={checkin.data.alreadyCheckedInToday || doCheckin.isPending} className="glass shadow-soft press mt-4 flex w-full items-center justify-between rounded-[1.5rem] p-5 text-left"><span><span className="label-editorial">DAILY CHECK-IN</span><span className="mt-1 block font-medium">{checkin.data.greeting}</span><span className="mt-1 block text-xs text-muted-foreground">Streak {checkin.data.streak} วัน {checkin.data.freezeAvailable > 0 ? `· ❄️ ${checkin.data.freezeAvailable}` : ""}</span></span><span className={`rounded-full px-4 py-2 text-xs font-semibold ${checkin.data.alreadyCheckedInToday ? "bg-live/15 text-live" : "bg-foreground text-background"}`}>{checkin.data.alreadyCheckedInToday ? "เช็คอินแล้ว" : doCheckin.isPending ? "กำลังเช็คอิน…" : "เช็คอิน"}</span></button>}

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between"><div><span className="label-editorial">QUICK TOOLS</span><h2 className="mt-1 text-xl font-bold">เครื่องมือของคุณ</h2></div><Link to="/diary" className="text-xs font-semibold text-primary">ดูไดอารี →</Link></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tools.map((t) => { const Icon = t.icon; const tone = t.tone === "mint" ? "bg-mint-soft text-primary" : t.tone === "sky" ? "bg-sky-soft text-signal" : t.tone === "peach" ? "bg-peach-soft text-accent-foreground" : "bg-[color:var(--lilac)]/15 text-foreground"; return <Link key={t.to} to={t.to} className="glass shadow-soft press rounded-2xl p-4"><span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon className="size-4" /></span><p className="mt-4 truncate text-sm font-semibold">{t.title}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{t.desc}</p></Link>; })}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between"><span className="label-editorial">RECENT MEALS</span><Link to="/diary" className="text-xs font-semibold text-primary">ทั้งหมด →</Link></div>
        <div className="glass shadow-soft rounded-[1.5rem] p-5">
          {diary.isLoading ? <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : diary.isError || !diary.data ? <ErrorState error={diary.error} onRetry={() => void diary.refetch()} /> : diary.data.length === 0 ? <p className="text-sm text-muted-foreground">ยังไม่มีมื้ออาหารวันนี้ — เริ่มจากการสแกนอาหารได้เลย</p> : <ul className="space-y-3">{diary.data.slice(-4).reverse().map((m) => <li key={m.id} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5"><span className="text-xl">{m.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.name}</p><p className="text-[10px] text-muted-foreground">{m.time} · {m.slot}</p></div><span className="font-bold tabular-nums">{m.kcal}<span className="ml-1 text-[10px] font-normal text-muted-foreground">kcal</span></span></li>)}</ul>}
        </div>
      </section>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Link to="/diary" className="glass press rounded-2xl p-4"><Plus className="size-4 text-primary" /><p className="mt-3 text-sm font-semibold">บันทึกมื้อ</p></Link>
        <Link to="/assistant" className="glass press rounded-2xl p-4"><MessageSquareHeart className="size-4 text-primary" /><p className="mt-3 text-sm font-semibold">ถาม AI</p></Link>
        <Link to="/stats" className="glass press rounded-2xl p-4"><Target className="size-4 text-primary" /><p className="mt-3 text-sm font-semibold">ดูสถิติ</p></Link>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl bg-white/25 px-3 py-2.5 backdrop-blur-sm"><div className="flex items-center gap-1 text-[10px] opacity-75">{icon}{label}</div><div className="mt-1 font-mono text-sm font-semibold">{value}</div></div>;
}
