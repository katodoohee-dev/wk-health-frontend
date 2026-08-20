import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Footprints, LogOut, MessageSquareHeart, Wallet,
  Dumbbell, Music2, UserRound, Plus, Snowflake, Image as ImageIcon,
  Users, Download, BellRing, ScanLine, Watch,
} from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiCheckin, apiCheckinToday, apiDiary, apiPedometerToday, apiStatsToday, todayISO } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WK Health — Health OS ประจำวันของคุณ" },
      { name: "description", content: "ศูนย์กลางสุขภาพรายวัน: แคลอรีคงเหลือ ก้าวเดิน น้ำ มื้ออาหาร และเครื่องมือทั้งหมดของ WK Health ในหน้าเดียว" },
      { property: "og:title", content: "WK Health — Health OS ประจำวันของคุณ" },
      { property: "og:description", content: "ตัวเลขสุขภาพจริงจากระบบ WK Health พร้อมสแกนอาหาร นับก้าวด้วย GPS และผู้ช่วย AI" },
    ],
  }),
  component: Home,
});

// หมายเหตุ: ยังไม่มี route "/run" แยกต่างหากใน repo นี้ — การนับก้าว/GPS ทำงานอยู่ที่ "/pedometer"
const tools = [
  { to: "/mood", icon: MessageSquareHeart, title: "Mood Menu", desc: "เมนูตามอารมณ์" },
  { to: "/budget", icon: Wallet, title: "Budget Planner", desc: "วางแผนตามงบ" },
  { to: "/pedometer", icon: Footprints, title: "Pedometer", desc: "นับก้าว + GPS" },
  { to: "/device-connect", icon: Watch, title: "เชื่อมอุปกรณ์", desc: "HealthKit/Google Fit" },
  { to: "/workout", icon: Dumbbell, title: "Workout", desc: "ตารางฝึก AI" },
  { to: "/music", icon: Music2, title: "Music", desc: "เพลย์ลิสต์คลอ" },
  { to: "/profile", icon: UserRound, title: "Profile & BMI", desc: "ข้อมูล + คำนวณ BMI" },
  { to: "/gallery", icon: ImageIcon, title: "แกลเลอรี", desc: "ย้อนดูรูปอาหาร" },
  { to: "/friends", icon: Users, title: "เพื่อนและ Streak", desc: "เชียร์กัน ไม่แข่งตัวเลข" },
  { to: "/export", icon: Download, title: "ส่งออกข้อมูล", desc: "PDF/CSV + สำรองข้อมูล" },
  { to: "/notifications", icon: BellRing, title: "การแจ้งเตือน", desc: "แจ้งเตือนอัจฉริยะ" },
] as const;

function Home() {
  const { user, logout, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const date = todayISO();

  const stats = useQuery({ queryKey: ["stats", "today"], queryFn: apiStatsToday, enabled: isAuthenticated });
  const ped = useQuery({ queryKey: ["pedometer", "today"], queryFn: apiPedometerToday, enabled: isAuthenticated });
  const diary = useQuery({ queryKey: ["diary", date], queryFn: () => apiDiary(date), enabled: isAuthenticated });
  const checkin = useQuery({ queryKey: ["checkin", "today"], queryFn: apiCheckinToday, enabled: isAuthenticated });

  const doCheckin = useMutation({
    mutationFn: apiCheckin,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["checkin"] }),
  });

  const s = stats.data;
  const remaining = s ? s.goal - s.eaten + s.burned : 0;
  const waterGoal = s?.waterGoal ?? 8;
  const water = s?.water ?? 0;
  const macroBars = s
    ? [
        { label: "Protein", th: "โปรตีน", value: s.protein, max: s.proteinGoal },
        { label: "Carb", th: "คาร์บ", value: s.carb, max: s.carbGoal },
        { label: "Fat", th: "ไขมัน", value: s.fat, max: s.fatGoal },
      ]
    : [];

  return (
    <div className="anim-rise pb-8">
      <header className="hairline-b flex items-center justify-between py-5">
        <div className="min-w-0">
          <span className="label-editorial">Today</span>
          <h1 className="font-display mt-1 truncate text-[20px] font-medium tracking-tight">
            คุณ{user?.name ?? user?.email ?? "ผู้ใช้"}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {s?.streak ? (
            <span className="mr-1 border border-hairline px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
              streak {s.streak}
            </span>
          ) : null}
          <Link to="/profile" aria-label="โปรไฟล์" className="press grid size-10 place-items-center border border-hairline">
            <UserRound className="size-4" />
          </Link>
          <ThemeToggle />
          <button onClick={() => void logout()} aria-label="ออกจากระบบ" className="press grid size-10 place-items-center border border-hairline">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {stats.isLoading || !s ? (
        <Skeleton className="mt-8 h-48 w-full" />
      ) : stats.isError ? (
        <div className="mt-8"><ErrorState error={stats.error} onRetry={() => void stats.refetch()} /></div>
      ) : (
        <section className="pt-8 pb-10">
          <div className="flex items-end gap-4">
            <span className="numeral text-[104px] font-semibold tabular-nums">{remaining}</span>
            <div className="pb-4">
              <div className="label-editorial">kcal เหลือได้</div>
              <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                {s!.eaten} กิน · {s!.burned} เผาผลาญ · เป้า {s!.goal}
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-5">
            {macroBars.map((m) => (
              <div key={m.label}>
                <div className="flex items-baseline justify-between">
                  <span className="label-editorial">{m.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {Math.round(m.value)} / {Math.round(m.max)} g
                  </span>
                </div>
                <div className="mt-2 h-px w-full bg-hairline">
                  <div
                    className="h-px bg-foreground"
                    style={{ width: `${Math.min(100, m.max ? (m.value / m.max) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {checkin.data && (
        <button
          onClick={() => !checkin.data!.alreadyCheckedInToday && doCheckin.mutate()}
          disabled={checkin.data.alreadyCheckedInToday || doCheckin.isPending}
          className="hairline-t press flex w-full items-center justify-between gap-3 py-6 text-left disabled:cursor-default"
        >
          <span className="min-w-0">
            <span className="label-editorial">Check-in</span>
            <span className="mt-2 block truncate text-[15px]">{checkin.data.greeting}</span>
            <span className="mt-1 flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
              streak {checkin.data.streak} วัน
              {checkin.data.freezeAvailable > 0 && (
                <span className="flex items-center gap-0.5"><Snowflake className="size-3" />×{checkin.data.freezeAvailable}</span>
              )}
            </span>
          </span>
          <span className={`shrink-0 px-4 py-2 font-mono text-[10px] tracking-[0.14em] uppercase ${checkin.data.alreadyCheckedInToday ? "text-live" : "bg-foreground text-background"}`}>
            {checkin.data.alreadyCheckedInToday ? "เช็คอินแล้ว" : doCheckin.isPending ? "กำลังเช็คอิน…" : "เช็คอิน"}
          </span>
        </button>
      )}

      <section className="hairline-t grid grid-cols-2">
        <Link to="/scan" className="press flex items-center gap-3 border-r border-hairline py-7 pr-6">
          <ScanLine className="size-5" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium">สแกนอาหาร</span>
            <span className="label-editorial block">instant kcal</span>
          </span>
        </Link>
        <Link to="/pedometer" className="press flex items-center gap-3 py-7 pl-6">
          <Footprints className="size-5" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium">ออกวิ่ง</span>
            <span className="label-editorial block">live gps track</span>
          </span>
        </Link>
      </section>

      <section className="hairline-t grid grid-cols-2">
        {ped.isLoading ? (
          <div className="col-span-2 py-7"><Skeleton className="h-20 w-full" /></div>
        ) : ped.isError || !ped.data ? (
          <div className="col-span-2 py-7"><ErrorState error={ped.error} onRetry={() => void ped.refetch()} /></div>
        ) : (
          <>
            <Link to="/pedometer" className="press border-r border-hairline py-7 pr-6">
              <div className="label-editorial">Steps</div>
              <div className="numeral mt-3 text-[30px] font-medium">{ped.data!.steps.toLocaleString()}</div>
              <div className="mt-2 text-[12px] text-muted-foreground">
                เป้า {ped.data!.goal.toLocaleString()} · {ped.data!.distanceKm} กม.
              </div>
            </Link>
            <div className="py-7 pl-6">
              <div className="label-editorial">Water</div>
              <div className="numeral mt-3 text-[30px] font-medium">
                {water}
                <span className="font-mono text-[11px] text-muted-foreground"> / {waterGoal} แก้ว</span>
              </div>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: waterGoal }).map((_, i) => (
                  <span key={i} className={`h-1.5 w-3 ${i < water ? "bg-live" : "bg-surface-2"}`} />
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="hairline-t py-8">
        <div className="flex items-center justify-between">
          <span className="label-editorial">มื้อล่าสุด</span>
          <Link to="/diary" className="label-editorial hover:text-foreground">ดูทั้งหมด</Link>
        </div>
        {diary.isLoading ? (
          <div className="mt-6 space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : diary.isError || !diary.data ? (
          <div className="mt-6"><ErrorState error={diary.error} onRetry={() => void diary.refetch()} /></div>
        ) : diary.data!.length === 0 ? (
          <p className="mt-6 text-[14px] text-muted-foreground">ยังไม่มีมื้ออาหารวันนี้ — เริ่มจากการสแกนอาหารได้เลย</p>
        ) : (
          <ul className="mt-6 space-y-5">
            {diary.data!.slice(-3).reverse().map((m) => (
              <li key={m.id} className="flex items-center gap-4">
                <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">{m.time}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">{m.emoji} {m.name}</p>
                  <p className="label-editorial mt-1">{m.slot}</p>
                </div>
                <span className="numeral shrink-0 text-[20px] font-medium">{m.kcal}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hairline-t py-8">
        <div className="flex items-center justify-between">
          <span className="label-editorial">เครื่องมือของคุณ</span>
          <Link to="/diary" className="press label-editorial inline-flex items-center gap-1 hover:text-foreground">
            <Plus className="size-3" /> บันทึกมื้อ
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 border-t border-l border-hairline lg:grid-cols-4">
          {tools.map((t) => (
            <Link key={t.to} to={t.to} className="press border-r border-b border-hairline p-5">
              <t.icon className="size-4" />
              <p className="mt-4 truncate text-[14px] font-medium">{t.title}</p>
              <p className="mt-1 truncate text-[12px] text-muted-foreground">{t.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
