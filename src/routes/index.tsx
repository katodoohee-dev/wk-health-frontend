import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, ChevronRight, Footprints, LogOut, Sparkles, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiCheckin, apiCheckinToday, apiDiary, apiPedometerToday, apiStatsToday, todayISO } from "@/lib/api";

export const Route = createFileRoute("/")({ head: () => ({ meta: [{ title: "WK Health — Health OS" }, { name: "description", content: "ศูนย์กลางสุขภาพรายวันของ WK Health" }] }), component: Home });

function Home() {
  const { user, logout, isAuthenticated } = useAuth();
  const qc = useQueryClient(); const date = todayISO();
  const stats = useQuery({ queryKey: ["stats", "today"], queryFn: apiStatsToday, enabled: isAuthenticated });
  const ped = useQuery({ queryKey: ["pedometer", "today"], queryFn: apiPedometerToday, enabled: isAuthenticated });
  const diary = useQuery({ queryKey: ["diary", date], queryFn: () => apiDiary(date), enabled: isAuthenticated });
  const checkin = useQuery({ queryKey: ["checkin", "today"], queryFn: apiCheckinToday, enabled: isAuthenticated });
  const doCheckin = useMutation({ mutationFn: apiCheckin, onSuccess: () => void qc.invalidateQueries({ queryKey: ["checkin"] }) });
  const s = stats.data; const remaining = s ? s.goal - s.eaten + s.burned : 0;

  return <div className="rise-in pb-10">
    <header className="flex items-center justify-between gap-4 py-6">
      <div><p className="label-editorial mb-2">WK HEALTH · PERSONAL OS</p><h1 className="font-display text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">สวัสดี, {user?.name ?? user?.email ?? "คุณ"}</h1><p className="mt-1 text-sm text-muted-foreground">ภาพรวมร่างกายของคุณในวันนี้</p></div>
      <div className="flex shrink-0 items-center gap-2"><Link to="/profile" aria-label="โปรไฟล์" className="press grid size-11 place-items-center rounded-full border border-hairline bg-surface-1"><UserRound className="size-4" /></Link><ThemeToggle /><button onClick={() => void logout()} aria-label="ออกจากระบบ" className="press hidden size-11 place-items-center rounded-full border border-hairline bg-surface-1 sm:grid"><LogOut className="size-4" /></button></div>
    </header>

    {checkin.data && <button onClick={() => !checkin.data!.alreadyCheckedInToday && doCheckin.mutate()} disabled={checkin.data.alreadyCheckedInToday || doCheckin.isPending} className="press mb-6 flex w-full items-center gap-3 border-b border-hairline pb-4 text-left disabled:cursor-default"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background">{checkin.data.alreadyCheckedInToday ? <CheckCircle2 className="size-4" /> : <span>+</span>}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Streak {checkin.data.streak} วัน</span><span className="block truncate text-xs text-muted-foreground">{checkin.data.greeting}</span></span>{!checkin.data.alreadyCheckedInToday && <span className="text-xs font-semibold">เช็คอิน →</span>}</button>}

    {stats.isLoading ? <Skeleton className="h-[330px] w-full rounded-[2rem]" /> : stats.isError ? <ErrorState error={stats.error} onRetry={() => void stats.refetch()} /> : <section className="border-y border-hairline py-8 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-end">
        <div><p className="label-editorial mb-3">TODAY'S BALANCE</p><div className="flex items-end gap-3"><span className="font-display text-[clamp(5rem,18vw,9rem)] font-semibold leading-[0.78] tracking-[-0.09em] tabular-nums">{Math.max(0, Math.round(remaining))}</span><span className="mb-2 text-sm text-muted-foreground">kcal<br />remaining</span></div><p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">สมดุลพลังงานวันนี้ จากอาหาร การเคลื่อนไหว และเป้าหมายส่วนตัวของคุณ</p></div>
        <div className="grid grid-cols-3 border-t border-hairline pt-4 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">{[["กินแล้ว",s!.eaten],["เผาผลาญ",s!.burned],["เป้าหมาย",s!.goal]].map(([label,value]) => <div key={String(label)} className="pr-3"><p className="label-editorial mb-2">{label}</p><p className="font-display text-xl font-semibold tabular-nums">{Math.round(Number(value))}</p><p className="text-[10px] text-muted-foreground">kcal</p></div>)}</div>
      </div>
      <div className="mt-10 grid gap-3 sm:grid-cols-3"><Bar label="Protein" value={s!.protein} max={s!.proteinGoal} /><Bar label="Carbs" value={s!.carb} max={s!.carbGoal} /><Bar label="Fat" value={s!.fat} max={s!.fatGoal} /></div>
    </section>}

    <section className="grid gap-6 border-b border-hairline py-7 sm:grid-cols-2 lg:grid-cols-3">
      <Link to="/assistant" className="press group sm:col-span-2 lg:col-span-2"><p className="label-editorial mb-2">WK INSIGHT</p><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background"><Sparkles className="size-4" /></span><div className="min-w-0 flex-1"><p className="font-display text-xl font-semibold tracking-[-0.03em]">วันนี้เริ่มต้นได้ดี</p><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">ถาม WK เพื่อดูว่าอาหาร การเคลื่อนไหว และเป้าหมายวันนี้สัมพันธ์กันอย่างไร</p></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div></Link>
      {ped.isLoading ? <Skeleton className="h-28 rounded-2xl" /> : ped.isError ? <ErrorState error={ped.error} onRetry={() => void ped.refetch()} /> : <Link to="/pedometer" className="press border-l border-hairline pl-0 sm:pl-5"><p className="label-editorial mb-2">MOVEMENT</p><p className="font-display text-3xl font-semibold tabular-nums">{ped.data!.steps.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">ก้าว · {ped.data!.distanceKm} กม. · {ped.data!.kcal} kcal</p></Link>}
    </section>

    <section className="py-7"><div className="mb-4 flex items-end justify-between"><div><p className="label-editorial mb-1">TODAY</p><h2 className="font-display text-xl font-semibold">Recent meals</h2></div><Link to="/diary" className="press text-xs font-medium text-muted-foreground">ดูทั้งหมด <ChevronRight className="inline size-3" /></Link></div>
      {diary.isLoading ? <div className="space-y-2"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-14 rounded-xl" /></div> : diary.isError ? <ErrorState error={diary.error} onRetry={() => void diary.refetch()} /> : diary.data!.length === 0 ? <p className="border-y border-hairline py-8 text-center text-sm text-muted-foreground">ยังไม่มีมื้ออาหารวันนี้ — เริ่มจากการสแกนอาหาร</p> : <div className="divide-y divide-hairline border-y border-hairline">{diary.data!.slice(-4).reverse().map((m) => <div key={m.id} className="flex items-center gap-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm">{m.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.slot} · {m.time}</p></div><span className="text-sm font-medium tabular-nums">{m.kcal} kcal</span></div>)}</div>}
    </section>
  </div>;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) { const pct = max ? Math.min(100, Math.max(0, value / max * 100)) : 0; return <div><div className="mb-1.5 flex justify-between text-xs"><span>{label}</span><span className="text-muted-foreground tabular-nums">{Math.round(value)} / {Math.round(max)}g</span></div><div className="h-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-foreground transition-all duration-500" style={{ width: `${pct}%` }} /></div></div>; }
