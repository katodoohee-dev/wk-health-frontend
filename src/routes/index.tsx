import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Brain, Droplets, Flame, Footprints, LogOut, MessageSquareHeart, Sparkle, Wallet,
  Dumbbell, Music2, UserRound, ChevronRight, Plus,
} from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Bar, GlassCard, Ring, SectionTitle } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiDiary, apiPedometerToday, apiStatsToday, todayISO } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WK Health App — ตรวจแคลอรีจากรูปอาหาร" },
      { name: "description", content: "แอปสุขภาพครบวงจร สแกนแคลอรีจากรูปอาหาร บันทึกไดอารี ดูสถิติ ผู้ช่วย AI เมนูตามอารมณ์ วางแผนงบ และนับก้าวเดิน" },
      { property: "og:title", content: "WK Health App — ตรวจแคลอรีจากรูปอาหาร" },
      { property: "og:description", content: "สแกนอาหาร รู้แคลอรีทันที พร้อมไดอารี สถิติ และผู้ช่วย AI ด้านโภชนาการ" },
    ],
  }),
  component: Home,
});

const tools = [
  { to: "/nlp", icon: Brain, title: "NLP Analyze", desc: "พิมพ์บรรยายอาหาร", tint: "bg-sky-soft text-sky" },
  { to: "/mood", icon: MessageSquareHeart, title: "Mood Menu", desc: "เมนูตามอารมณ์", tint: "bg-peach-soft text-peach" },
  { to: "/budget", icon: Wallet, title: "Budget Planner", desc: "วางแผนตามงบ", tint: "bg-mint-soft text-mint" },
  { to: "/pedometer", icon: Footprints, title: "Pedometer", desc: "นับก้าว + GPS", tint: "bg-secondary text-secondary-foreground" },
  { to: "/workout", icon: Dumbbell, title: "Workout", desc: "ตารางฝึก AI", tint: "bg-mint-soft text-mint" },
  { to: "/music", icon: Music2, title: "Music", desc: "เพลย์ลิสต์คลอ", tint: "bg-sky-soft text-sky" },
  { to: "/profile", icon: UserRound, title: "Profile & BMI", desc: "ข้อมูล + คำนวณ BMI", tint: "bg-peach-soft text-peach" },
] as const;

function Home() {
  const { user, logout, isAuthenticated } = useAuth();
  const date = todayISO();

  const stats = useQuery({ queryKey: ["stats", "today"], queryFn: apiStatsToday, enabled: isAuthenticated });
  const ped = useQuery({ queryKey: ["pedometer", "today"], queryFn: apiPedometerToday, enabled: isAuthenticated });
  const diary = useQuery({ queryKey: ["diary", date], queryFn: () => apiDiary(date), enabled: isAuthenticated });

  const s = stats.data;
  const remaining = s ? s.goal - s.eaten + s.burned : 0;
  const waterGoal = s?.waterGoal ?? 8;
  const water = s?.water ?? 0;

  return (
    <div className="rise-in">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">สวัสดี 🌿</p>
          <h1 className="truncate font-display text-2xl font-bold">คุณ{user?.name ?? user?.email ?? "ผู้ใช้"}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {s?.streak ? <span className="glass rounded-2xl px-3 py-2.5 text-sm font-semibold">🔥 {s.streak} วัน</span> : null}
          <Link to="/profile" aria-label="โปรไฟล์" className="press glass grid size-11 place-items-center rounded-2xl shadow-soft">
            <UserRound className="size-5" />
          </Link>
          <ThemeToggle />
          <button onClick={() => void logout()} aria-label="ออกจากระบบ" className="press glass grid size-11 place-items-center rounded-2xl shadow-soft">
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      {stats.isLoading ? (
        <Skeleton className="h-64 w-full rounded-3xl" />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <GlassCard className="p-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
            <Ring value={s!.eaten} max={s!.goal} color="var(--mint)">
              <div>
                <p className="font-display text-3xl font-bold tabular-nums">{remaining}</p>
                <p className="text-xs text-muted-foreground">kcal เหลือได้</p>
              </div>
            </Ring>
            <div className="w-full min-w-0 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="กินแล้ว" value={s!.eaten} icon="🍽️" />
                <MiniStat label="เผาผลาญ" value={s!.burned} icon="🔥" />
                <MiniStat label="เป้าหมาย" value={s!.goal} icon="🎯" />
              </div>
              <Bar label="โปรตีน" value={s!.protein} max={s!.proteinGoal} color="var(--mint)" />
              <Bar label="คาร์บ" value={s!.carb} max={s!.carbGoal} color="var(--sky)" />
              <Bar label="ไขมัน" value={s!.fat} max={s!.fatGoal} color="var(--peach)" />
            </div>
          </div>
        </GlassCard>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/scan" className="press bg-mint-gradient flex items-center gap-3 rounded-3xl p-4 text-primary-foreground shadow-glow">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-background/25"><Sparkle className="size-5" /></span>
          <span className="min-w-0">
            <span className="block truncate font-display font-semibold">สแกนอาหาร</span>
            <span className="block truncate text-xs opacity-80">ถ่ายรูป รู้แคลทันที</span>
          </span>
        </Link>
        <Link to="/diary" className="press glass-strong flex items-center gap-3 rounded-3xl p-4 shadow-soft">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-peach-soft text-peach"><Plus className="size-5" /></span>
          <span className="min-w-0">
            <span className="block truncate font-display font-semibold">บันทึกมื้อ</span>
            <span className="block truncate text-xs text-muted-foreground">เพิ่มลงไดอารี</span>
          </span>
        </Link>
      </div>

      <section className="mt-6">
        <SectionTitle title="เครื่องมือของคุณ" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tools.map((t) => (
            <Link key={t.to} to={t.to} className="press glass-strong group rounded-3xl p-4 shadow-soft">
              <span className={`grid size-11 place-items-center rounded-2xl ${t.tint}`}><t.icon className="size-5" /></span>
              <p className="mt-3 truncate font-display font-semibold">{t.title}</p>
              <p className="truncate text-xs text-muted-foreground">{t.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {ped.isLoading ? (
          <Skeleton className="h-32 w-full rounded-3xl" />
        ) : ped.isError ? (
          <ErrorState error={ped.error} onRetry={() => void ped.refetch()} />
        ) : (
          <Link to="/pedometer" className="press glass-strong rounded-3xl p-4 shadow-soft">
            <div className="flex items-center gap-4">
              <Ring value={ped.data!.steps} max={ped.data!.goal} size={92} stroke={10} color="var(--sky)">
                <Footprints className="size-6 text-sky" />
              </Ring>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">ก้าววันนี้</p>
                <p className="font-display text-2xl font-bold tabular-nums">{ped.data!.steps.toLocaleString()}</p>
                <p className="truncate text-xs text-muted-foreground">{ped.data!.distanceKm} กม. · {ped.data!.kcal} kcal</p>
              </div>
              <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground" />
            </div>
          </Link>
        )}

        <div className="glass-strong rounded-3xl p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold"><Droplets className="mr-1 inline size-4 text-sky" /> ดื่มน้ำ</p>
            <p className="text-xs text-muted-foreground">{water}/{waterGoal} แก้ว</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: waterGoal }).map((_, i) => (
              <span key={i} className={`press grid size-9 place-items-center rounded-xl text-base ${i < water ? "bg-sky-soft" : "bg-muted opacity-60"}`}>💧</span>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle title="มื้อล่าสุด" action={<Link to="/diary" className="text-xs font-medium text-primary">ดูทั้งหมด</Link>} />
        {diary.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>
        ) : diary.isError ? (
          <ErrorState error={diary.error} onRetry={() => void diary.refetch()} />
        ) : diary.data!.length === 0 ? (
          <p className="glass-strong rounded-3xl p-6 text-center text-sm text-muted-foreground">ยังไม่มีมื้ออาหารวันนี้ — เริ่มจากการสแกนอาหารได้เลย</p>
        ) : (
          <div className="space-y-2">
            {diary.data!.slice(-3).reverse().map((m) => (
              <div key={m.id} className="glass-strong flex items-center gap-3 rounded-2xl p-3 shadow-soft">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-xl">{m.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.slot} · {m.time}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-primary"><Flame className="mr-1 inline size-3.5" />{m.kcal}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-2 py-2">
      <p className="text-base">{icon}</p>
      <p className="font-display text-sm font-bold tabular-nums">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
