import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { ErrorState, LoadingState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiStatsToday, apiStatsWeekly } from "@/lib/api";

export const Route = createFileRoute("/stats")({ head: () => ({ meta: [{ title: "Health Intelligence — WK Health" }, { name: "description", content: "ภาพรวมแนวโน้มสุขภาพรายวันและรายสัปดาห์" }] }), component: StatsPage });

function score(t: { eaten: number; goal: number; protein: number; proteinGoal: number; carb: number; carbGoal: number; fat: number; fatGoal: number; water?: number; waterGoal?: number }) {
  const ratio = (v: number, g: number) => g > 0 ? Math.max(0, 1 - Math.abs(v - g) / g) : 1;
  const nutrition = (ratio(t.protein, t.proteinGoal) + ratio(t.carb, t.carbGoal) + ratio(t.fat, t.fatGoal)) / 3;
  const water = t.waterGoal ? Math.min(1, (t.water ?? 0) / t.waterGoal) : 1;
  return Math.round((ratio(t.eaten, t.goal) * 0.5 + nutrition * 0.3 + water * 0.2) * 100);
}

function StatsPage() {
  const { isAuthenticated } = useAuth();
  const weeklyQ = useQuery({ queryKey: ["stats", "weekly"], queryFn: apiStatsWeekly, enabled: isAuthenticated });
  const todayQ = useQuery({ queryKey: ["stats", "today"], queryFn: apiStatsToday, enabled: isAuthenticated });
  const weekly = weeklyQ.data ?? []; const t = todayQ.data;
  const avg = weekly.length ? Math.round(weekly.reduce((a, d) => a + d.kcal, 0) / weekly.length) : 0;
  const burn = weekly.reduce((a, d) => a + d.burn, 0); const steps = weekly.length ? Math.round(weekly.reduce((a, d) => a + d.steps, 0) / weekly.length) : 0;
  const healthScore = t ? score(t) : 0;
  const macro = t ? [{ name: "โปรตีน", value: t.protein }, { name: "คาร์บ", value: t.carb }, { name: "ไขมัน", value: t.fat }] : [];
  return <div className="rise-in pb-10">
    <header className="border-b border-hairline py-7 sm:py-9"><p className="label-editorial mb-2">HEALTH INTELLIGENCE</p><div className="flex flex-wrap items-end justify-between gap-5"><div><h1 className="font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Health overview</h1><p className="mt-2 text-sm text-muted-foreground">แนวโน้มที่ช่วยให้คุณเข้าใจร่างกาย ไม่ใช่แค่ตัวเลข</p></div><div className="text-left sm:text-right"><p className="font-display text-5xl font-semibold tracking-[-0.08em] tabular-nums">{healthScore}</p><p className="label-editorial mt-1">TODAY'S SCORE</p></div></div></header>
    {weeklyQ.isError ? <div className="py-6"><ErrorState error={weeklyQ.error} onRetry={() => void weeklyQ.refetch()} /></div> : weeklyQ.isLoading ? <div className="py-6"><LoadingState label="กำลังอ่านแนวโน้มสุขภาพ…" /></div> : <>
      <section className="grid divide-y divide-hairline border-b border-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0"><Metric label="ค่าเฉลี่ยพลังงาน" value={avg.toLocaleString()} unit="kcal / วัน" /><Metric label="เผาผลาญรวม" value={burn.toLocaleString()} unit="kcal / สัปดาห์" /><Metric label="ก้าวเฉลี่ย" value={steps.toLocaleString()} unit="ก้าว / วัน" /></section>
      <section className="border-b border-hairline py-7 sm:py-9"><div className="mb-5 flex items-end justify-between"><div><p className="label-editorial mb-1">ENERGY TREND</p><h2 className="font-display text-xl font-semibold">พลังงานเข้าเทียบกับที่ใช้</h2></div><span className="text-xs text-muted-foreground">7 วันล่าสุด</span></div><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weekly} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}><defs><linearGradient id="wkEnergy" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity={0.14}/><stop offset="100%" stopColor="currentColor" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11}/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="kcal" stroke="currentColor" strokeWidth={2.5} fill="url(#wkEnergy)"/><Area type="monotone" dataKey="burn" stroke="var(--muted-foreground)" strokeWidth={1.5} fill="none" strokeDasharray="5 5"/></AreaChart></ResponsiveContainer></div></section>
      <section className="grid gap-7 border-b border-hairline py-7 sm:grid-cols-2 sm:py-9"><div><p className="label-editorial mb-1">NUTRITION</p><h2 className="font-display text-xl font-semibold">สารอาหารวันนี้</h2><div className="mt-6 space-y-4">{macro.map(m => <div key={m.name}><div className="mb-1.5 flex justify-between text-xs"><span>{m.name}</span><span className="tabular-nums text-muted-foreground">{m.value} g</span></div><div className="h-1 rounded-full bg-surface-2"><div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, Number(m.value) / Math.max(1, Number(m.value) + 20) * 100)}%` }}/></div></div>)}</div></div><div><p className="label-editorial mb-1">MOVEMENT</p><h2 className="font-display text-xl font-semibold">ก้าวเดิน</h2><div className="mt-5 h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={weekly} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11}/><Tooltip content={<Tip unit="ก้าว"/>}/><Bar dataKey="steps" fill="currentColor" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div></section>
    </>}
  </div>;
}
function Metric({ label, value, unit }: { label: string; value: string; unit: string }) { return <div className="py-5 sm:px-5 sm:py-7"><p className="label-editorial mb-2">{label}</p><p className="font-display text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p><p className="mt-1 text-xs text-muted-foreground">{unit}</p></div>; }
function Tip({ active, payload, label, unit = "kcal" }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string; unit?: string }) { if (!active || !payload?.length) return null; return <div className="rounded-xl border border-hairline bg-background px-3 py-2 text-xs shadow-soft"><p className="mb-1 font-semibold">{label}</p>{payload.map((p, i) => <p key={i} className="tabular-nums text-muted-foreground">{p.name}: {p.value} {unit}</p>)}</div>; }
