import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, GlassCard, Chip } from "@/components/app/ui-bits";
import { ErrorState, LoadingState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiMoodList, apiMoodRecommend } from "@/lib/api";

export const Route = createFileRoute("/mood")({
  head: () => ({
    meta: [
      { title: "เมนูตามอารมณ์ — WK Health App" },
      { name: "description", content: "เลือกอารมณ์วันนี้ แล้วรับเมนูอาหารที่เหมาะกับความรู้สึกและร่างกายคุณ" },
      { property: "og:title", content: "เมนูตามอารมณ์ — WK Health App" },
      { property: "og:description", content: "วันนี้รู้สึกยังไง? เราจัดเมนูที่เหมาะให้" },
    ],
  }),
  component: MoodPage,
});

function MoodPage() {
  const { isAuthenticated } = useAuth();
  const [moodKey, setMoodKey] = useState<string>("");
  const [meal, setMeal] = useState<"breakfast" | "main">("main");

  const moodsQ = useQuery({ queryKey: ["mood", "list"], queryFn: apiMoodList, enabled: isAuthenticated });

  useEffect(() => {
    if (!moodKey && moodsQ.data?.length) setMoodKey(moodsQ.data[0]!.key);
  }, [moodsQ.data, moodKey]);

  const recQ = useQuery({
    queryKey: ["mood", "recommend", moodKey, meal],
    queryFn: () => apiMoodRecommend(moodKey, meal),
    enabled: isAuthenticated && Boolean(moodKey),
  });

  const mood = moodsQ.data?.find((m) => m.key === moodKey);

  return (
    <div className="rise-in">
      <PageHeader title="Mood Menu" emoji="💚" subtitle="วันนี้รู้สึกยังไง?" />

      {moodsQ.isLoading ? (
        <LoadingState label="กำลังโหลดรายการอารมณ์…" />
      ) : moodsQ.isError ? (
        <ErrorState error={moodsQ.error} onRetry={() => void moodsQ.refetch()} />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {moodsQ.data!.map((m) => {
            const active = m.key === moodKey;
            return (
              <button key={m.key} onClick={() => setMoodKey(m.key)}
                className={`press flex flex-col items-center gap-1 rounded-3xl py-4 shadow-soft ${active ? "bg-mint-gradient text-primary-foreground shadow-glow" : "glass-strong"}`}>
                <span className={`text-3xl transition-transform ${active ? "scale-110" : ""}`}>{m.emoji}</span>
                <span className="truncate text-xs font-medium">{m.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {mood && (
        <GlassCard className="mt-4 p-4">
          <p className="text-sm">
            <span className="text-2xl">{mood.emoji}</span> <span className="font-display font-semibold">{mood.label}</span>
            {mood.hint ? <> — <span className="text-muted-foreground">{mood.hint}</span></> : null}
          </p>
        </GlassCard>
      )}

      <div className="mt-4 flex gap-2">
        <Chip active={meal === "breakfast"} onClick={() => setMeal("breakfast")}>มื้อเช้า</Chip>
        <Chip active={meal === "main"} onClick={() => setMeal("main")}>มื้อหลัก</Chip>
      </div>

      <div className="mt-4 space-y-3">
        {recQ.isLoading ? (
          <><Skeleton className="h-24 w-full rounded-3xl" /><Skeleton className="h-24 w-full rounded-3xl" /></>
        ) : recQ.isError ? (
          <ErrorState error={recQ.error} onRetry={() => void recQ.refetch()} />
        ) : (recQ.data ?? []).length === 0 ? (
          <p className="glass-strong rounded-3xl p-8 text-center text-sm text-muted-foreground">ยังไม่มีเมนูแนะนำสำหรับอารมณ์นี้</p>
        ) : (
          recQ.data!.map((item, i) => (
            <div key={`${item.name}-${i}`} className="glass-strong rise-in flex items-center gap-3 rounded-3xl p-4 shadow-soft" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-peach-soft text-3xl">{item.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.why}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-primary">{item.kcal} kcal</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
