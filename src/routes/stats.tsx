import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader, GlassCard, SectionTitle } from "@/components/app/ui-bits";
import { ErrorState, LoadingState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiStatsToday, apiStatsWeekly } from "@/lib/api";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "สถิติสุขภาพ — WK Health App" },
      { name: "description", content: "กราฟสรุปแคลอรี สารอาหาร และกิจกรรมรายสัปดาห์แบบเข้าใจง่าย" },
      { property: "og:title", content: "สถิติสุขภาพ — WK Health App" },
      { property: "og:description", content: "กราฟสรุปแคลอรีและกิจกรรมรายสัปดาห์" },
    ],
  }),
  component: StatsPage,
});

/** ให้เกรดวันนี้จากความใกล้เคียงเป้าแคลอรี + สัดส่วนสารอาหาร + น้ำดื่ม (คำนวณฝั่ง client จาก TodayStats ที่มีอยู่แล้ว) */
function computeGrade(t: { eaten: number; goal: number; protein: number; proteinGoal: number; carb: number; carbGoal: number; fat: number; fatGoal: number; water?: number; waterGoal?: number }) {
  const ratio = (v: number, g: number) => (g > 0 ? Math.max(0, 1 - Math.abs(v - g) / g) : 1);
  const kcalScore = ratio(t.eaten, t.goal);
  const macroScore = (ratio(t.protein, t.proteinGoal) + ratio(t.carb, t.carbGoal) + ratio(t.fat, t.fatGoal)) / 3;
  const water = t.water ?? 0;
  const waterGoal = t.waterGoal ?? 0;
  const waterScore = waterGoal > 0 ? Math.min(1, water / waterGoal) : 1;
  const score = kcalScore * 0.5 + macroScore * 0.3 + waterScore * 0.2;
  if (score >= 0.9) return { grade: "A", label: "ยอดเยี่ยม", color: "var(--mint)" };
  if (score >= 0.75) return { grade: "B", label: "ดี", color: "var(--sky)" };
  if (score >= 0.55) return { grade: "C", label: "พอใช้", color: "var(--peach)" };
  return { grade: "D", label: "ต้องปรับปรุง", color: "var(--destructive, #e07a6b)" };
}

function GradeBadge({ t }: { t: Parameters<typeof computeGrade>[0] }) {
  const { grade, label, color } = computeGrade(t);
  return (
    <div className="glass-strong flex items-center gap-3 rounded-3xl p-4 shadow-soft">
      <span
        className="grid size-14 shrink-0 place-items-center rounded-2xl font-display text-2xl font-bold text-white"
        style={{ background: color }}
      >
        {grade}
      </span>
      <div className="min-w-0">
        <p className="font-display font-semibold">เกรดวันนี้ · {label}</p>
        <p className="truncate text-xs text-muted-foreground">อิงจากแคลอรี สัดส่วนสารอาหาร และน้ำดื่ม</p>
      </div>
    </div>
  );
}

function StatsPage() {
  const { isAuthenticated } = useAuth();
  const weeklyQ = useQuery({ queryKey: ["stats", "weekly"], queryFn: apiStatsWeekly, enabled: isAuthenticated });
  const todayQ = useQuery({ queryKey: ["stats", "today"], queryFn: apiStatsToday, enabled: isAuthenticated });

  const weekly = weeklyQ.data ?? [];
  const avg = weekly.length ? Math.round(weekly.reduce((s, d) => s + d.kcal, 0) / weekly.length) : 0;
  const burnTotal = weekly.reduce((s, d) => s + d.burn, 0);
  const avgSteps = weekly.length ? Math.round(weekly.reduce((s, d) => s + d.steps, 0) / weekly.length) : 0;

  const t = todayQ.data;
  const macroSplit = t ? [
    { name: "โปรตีน", value: t.protein, color: "var(--mint)" },
    { name: "คาร์บ", value: t.carb, color: "var(--sky)" },
    { name: "ไขมัน", value: t.fat, color: "var(--peach)" },
  ] : [];

  return (
    <div className="rise-in">
      <PageHeader title="สถิติ" emoji="📊" subtitle="ภาพรวมผลลัพธ์ของคุณ" />

      {t && (
        <div className="mb-4">
          <GradeBadge t={t} />
        </div>
      )}

      {weeklyQ.isError ? (
        <ErrorState error={weeklyQ.error} onRetry={() => void weeklyQ.refetch()} />
      ) : weeklyQ.isLoading ? (
        <LoadingState label="กำลังโหลดสถิติ…" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="เฉลี่ยต่อวัน" value={avg.toLocaleString()} unit="kcal" />
            <KpiCard label="เผาผลาญรวม" value={burnTotal.toLocaleString()} unit="kcal" />
            <KpiCard label="ก้าวเฉลี่ย" value={avgSteps.toLocaleString()} unit="ก้าว" />
          </div>

          <GlassCard className="mt-4 p-4">
            <SectionTitle title="แคลอรีที่ได้รับ vs เผาผลาญ" />
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weekly} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--mint)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--mint)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--peach)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--peach)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="kcal" stroke="var(--mint)" strokeWidth={3} fill="url(#gIn)" />
                  <Area type="monotone" dataKey="burn" stroke="var(--peach)" strokeWidth={3} fill="url(#gOut)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <GlassCard className="p-4">
          <SectionTitle title="สัดส่วนสารอาหารวันนี้" />
          {todayQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : todayQ.isError ? (
            <ErrorState error={todayQ.error} onRetry={() => void todayQ.refetch()} />
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={macroSplit} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={4} stroke="none">
                      {macroSplit.map((m) => (<Cell key={m.name} fill={m.color} />))}
                    </Pie>
                    <Tooltip content={<ChartTip unit="g" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-2 text-sm">
                {macroSplit.map((m) => (
                  <li key={m.name} className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: m.color }} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{m.value} g</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <SectionTitle title="ก้าวเดินรายวัน" />
          {weeklyQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : weeklyQ.isError ? (
            <ErrorState error={weeklyQ.error} onRetry={() => void weeklyQ.refetch()} />
          ) : (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip content={<ChartTip unit="ก้าว" />} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="steps" fill="var(--sky)" radius={[8, 8, 8, 8]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function KpiCard({ label, value, unit, trend }: { label: string; value: string; unit: string; trend?: number }) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="glass-strong rounded-3xl p-4 shadow-soft">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums">{value} <span className="text-xs font-medium text-muted-foreground">{unit}</span></p>
      {trend !== undefined && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${up ? "text-primary" : "text-accent"}`}>
          {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />} {Math.abs(trend)}% จากสัปดาห์ก่อน
        </p>
      )}
    </div>
  );
}

function ChartTip({ active, payload, label, unit = "kcal" }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-2xl px-3 py-2 text-xs shadow-soft">
      {label ? <p className="mb-1 font-semibold">{label}</p> : null}
      {payload.map((p, i) => (<p key={i} className="tabular-nums" style={{ color: p.color }}>{p.name}: {p.value} {unit}</p>))}
    </div>
  );
}
