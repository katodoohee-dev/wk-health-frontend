import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Footprints, Flame, Sparkles } from "lucide-react";
import { AppShell } from "@/components/wk/app-shell";
import { BarSeries, Chip, Eyebrow, Metric, Panel, ProgressRing, SectionHeader } from "@/components/wk/primitives";
import { useAuth } from "@/lib/auth";
import { apiDiary, apiPedometerToday, apiStatsToday, apiStatsWeekly, todayISO } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "WK Health — Health OS" }, { name: "description", content: "ศูนย์กลางสุขภาพรายวันของ WK Health" }] }),
  component: HealthOverview,
});

function HealthOverview() {
  const { isAuthenticated, user } = useAuth();
  const stats = useQuery({ queryKey: ["stats", "today"], queryFn: apiStatsToday, enabled: isAuthenticated });
  const ped = useQuery({ queryKey: ["pedometer", "today"], queryFn: apiPedometerToday, enabled: isAuthenticated });
  const diary = useQuery({ queryKey: ["diary", todayISO()], queryFn: () => apiDiary(todayISO()), enabled: isAuthenticated });
  const weekly = useQuery({ queryKey: ["stats", "weekly"], queryFn: apiStatsWeekly, enabled: isAuthenticated });
  const s = stats.data;
  const remaining = s ? Math.max(0, s.goal - s.eaten + s.burned) : 0;
  const weekBars = (weekly.data ?? []).map((d) => ({ day: d.day, value: d.steps }));
  const stepPct = ped.data ? Math.min(100, Math.round((ped.data.steps / Math.max(1, ped.data.goal)) * 100)) : 0;

  return (
    <AppShell eyebrow="WK Health · Personal OS" title="Health overview">
      <div className="rise-in space-y-14">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Panel className="grain flex flex-col justify-between gap-10 lg:p-8">
            <div className="flex flex-wrap items-center gap-2"><Chip tone="signal">Synced with your account</Chip><Chip>{user?.name ?? user?.email ?? "Personal health OS"}</Chip></div>
            <div>
              <Eyebrow>Today's balance</Eyebrow>
              <div className="mt-3 flex items-end gap-4"><span className="numeric text-[5.5rem] leading-[0.85] font-medium sm:text-[7.5rem]">{Math.round(remaining)}</span><span className="pb-3 text-sm text-muted-foreground">kcal remaining</span></div>
              <p className="mt-6 max-w-lg text-[0.9375rem] leading-relaxed text-muted-foreground">ข้อมูลนี้มาจากสถิติ อาหาร และการเคลื่อนไหวของบัญชีคุณโดยตรง ไม่ใช้ข้อมูล mock</p>
            </div>
            <Link to="/assistant" className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:scale-[1.02]">Ask WK about today <ArrowUpRight className="size-4" /></Link>
          </Panel>
          <div className="grid grid-cols-2 gap-6">
            <Panel><Metric label="Calories eaten" value={s ? Math.round(s.eaten) : "—"} unit="kcal" /></Panel>
            <Panel><Metric label="Burned" value={s ? Math.round(s.burned) : "—"} unit="kcal" /></Panel>
            <Panel><Metric label="Protein" value={s ? Math.round(s.protein) : "—"} unit="g" /></Panel>
            <Panel><Metric label="Hydration" value={s ? Math.round(s.water ?? 0) : "—"} unit={`/ ${s?.waterGoal ?? 8} glasses`} /></Panel>
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Movement" title="Today, then the week" action={<Link to="/pedometer" className="text-xs underline underline-offset-4">Open movement ↗</Link>} />
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
            <Panel className="flex flex-col justify-between gap-8">
              <div><Eyebrow>Steps today</Eyebrow><p className="numeric mt-2 text-5xl">{ped.data ? ped.data.steps.toLocaleString() : "—"}</p><p className="mt-2 text-sm text-muted-foreground">{ped.data ? `${stepPct}% of your ${ped.data.goal.toLocaleString()} step goal` : "Connect movement data to populate this view."}</p></div>
              <div className="h-2 w-full rounded-full bg-surface-2"><div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${stepPct}%` }} /></div>
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-5"><Metric label="Distance" value={ped.data ? ped.data.distanceKm.toFixed(1) : "—"} unit="km" /><Metric label="Active" value={ped.data ? ped.data.activeMinutes : "—"} unit="min" /></div>
            </Panel>
            <Panel>
              <div className="mb-5 flex items-end justify-between"><div><Eyebrow>Activity · this week</Eyebrow><h2 className="display mt-1 text-2xl">Your movement rhythm</h2></div><span className="text-xs text-muted-foreground">7 days</span></div>
              {weekly.isError ? <p className="text-sm text-muted-foreground">Weekly activity is temporarily unavailable.</p> : weekly.data?.length ? <BarSeries items={weekBars} /> : <p className="py-12 text-center text-sm text-muted-foreground">No weekly movement data yet.</p>}
            </Panel>
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Food diary" title="What you have actually logged" action={<Link to="/diary" className="text-xs underline underline-offset-4">Open diary ↗</Link>} />
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.6fr)]">
            <Panel>
              {diary.isLoading ? <p className="text-sm text-muted-foreground">Reading today's diary…</p> : diary.data?.length ? <div className="divide-y divide-border">{diary.data.slice(0, 6).map((item) => <div key={item.id} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 py-4"><span className="numeric text-[10px] text-muted-foreground">{item.time || "—"}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.slot} · {item.source}</p></div><span className="numeric text-sm">{Math.round(item.kcal)} kcal</span></div>)}</div> : <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีรายการอาหารวันนี้</p>}
            </Panel>
            <Panel className="grain"><Eyebrow>Quick capture</Eyebrow><div className="mt-5 grid grid-cols-2"><Link to="/scan" className="border-b border-r border-border p-5 text-sm transition-colors hover:bg-surface-2">Scan meal</Link><Link to="/pedometer" className="border-b border-border p-5 text-sm transition-colors hover:bg-surface-2">Movement</Link><Link to="/mood" className="border-r border-border p-5 text-sm transition-colors hover:bg-surface-2">Mood check</Link><Link to="/music" className="p-5 text-sm transition-colors hover:bg-surface-2">Sound</Link></div></Panel>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel className="grain"><div className="flex items-center gap-2"><Chip tone="solid"><Flame className="size-3" /> Today</Chip><Chip>Live account</Chip></div><Eyebrow className="mt-7">Your nutrition targets</Eyebrow><div className="mt-6 grid grid-cols-3 gap-4"><ProgressRing value={Math.round(s?.protein ?? 0)} goal={Math.max(1, Math.round(s?.proteinGoal ?? 120))} label="Protein" unit="g" size={112}/><ProgressRing value={Math.round(s?.carb ?? 0)} goal={Math.max(1, Math.round(s?.carbGoal ?? 240))} label="Carb" unit="g" size={112}/><ProgressRing value={Math.round(s?.fat ?? 0)} goal={Math.max(1, Math.round(s?.fatGoal ?? 65))} label="Fat" unit="g" size={112}/></div></Panel>
          <Panel><div className="flex items-start justify-between gap-6"><div><Eyebrow>WK Assistant</Eyebrow><h2 className="display mt-2 text-3xl">Make sense of the day, not just the numbers.</h2><p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">ถามเรื่องอาหาร การนอน การออกกำลังกาย หรือให้ WK สรุปข้อมูลจากบัญชีคุณ</p></div><Sparkles className="size-5 shrink-0" /></div><Link to="/assistant" className="mt-7 inline-flex items-center gap-2 text-sm underline underline-offset-4">Open WK Assistant <ArrowUpRight className="size-4" /></Link></Panel>
        </section>
      </div>
    </AppShell>
  );
}
