import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Footprints, Dumbbell, Trophy, Lightbulb, TrendingUp } from "lucide-react";
import { PageHeader, GlassCard, SectionTitle } from "@/components/app/ui-bits";
import { ErrorState, LoadingState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiInsightWeekly } from "@/lib/api-new-features";

export const Route = createFileRoute("/insight")({
  head: () => ({
    meta: [
      { title: "Weekly Insight — WK Health App" },
      { name: "description", content: "สรุปผลลัพธ์รายสัปดาห์จากข้อมูลจริงในระบบ พร้อมคำแนะนำที่เหมาะกับคุณ" },
      { property: "og:title", content: "Weekly Insight — WK Health App" },
      { property: "og:description", content: "ดูภาพรวมสัปดาห์นี้ของคุณ" },
    ],
  }),
  component: InsightPage,
});

function StatTile({ icon: Icon, label, value, tint }: { icon: typeof Flame; label: string; value: string; tint: string }) {
  return (
    <GlassCard className="p-4">
      <span className={`grid size-10 place-items-center rounded-2xl ${tint}`}>
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </GlassCard>
  );
}

function InsightPage() {
  const { isAuthenticated } = useAuth();
  const q = useQuery({ queryKey: ["insight", "weekly"], queryFn: apiInsightWeekly, enabled: isAuthenticated });

  return (
    <div className="rise-in">
      <PageHeader title="Weekly Insight" emoji="✨" subtitle="สรุปผลลัพธ์จากข้อมูลจริงของคุณ 7 วันล่าสุด" />

      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-3xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <LoadingState />
      ) : (
        <>
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="size-5" />
              <p className="font-display font-semibold">สรุปสัปดาห์นี้</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{q.data.headline}</p>
          </GlassCard>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile icon={Flame} label={`เฉลี่ย kcal/วัน (บันทึก ${q.data.daysLogged}/7 วัน)`} value={`${q.data.avgKcal}`} tint="bg-peach-soft text-peach" />
            <StatTile icon={Trophy} label="วันที่อยู่ในเป้าหมาย" value={`${q.data.daysOnGoal}/7`} tint="bg-mint-soft text-mint" />
            <StatTile icon={Footprints} label="ก้าวเดินรวมสัปดาห์" value={q.data.totalSteps.toLocaleString("th-TH")} tint="bg-sky-soft text-sky" />
            <StatTile icon={Dumbbell} label="นาทีออกกำลังกายรวม" value={`${q.data.totalWorkoutMinutes}`} tint="bg-secondary text-secondary-foreground" />
          </div>

          {q.data.bestDay ? (
            <GlassCard className="mt-4 p-5">
              <SectionTitle title="วันที่ทำได้ดีที่สุด" />
              <p className="text-sm text-muted-foreground">
                {q.data.bestDay.date} — {q.data.bestDay.kcal} kcal
              </p>
            </GlassCard>
          ) : null}

          <GlassCard className="mt-4 p-5">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-5 text-peach" />
              <p className="font-display font-semibold">คำแนะนำสำหรับสัปดาห์หน้า</p>
            </div>
            <ul className="mt-3 space-y-2">
              {q.data.tips.map((tip, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </>
      )}
    </div>
  );
}
