import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Utensils, Droplets, Flame, Sparkles, Moon, Send } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiNotificationSettings, apiNotificationUpdate, apiNotificationTest } from "@/lib/api-new-features";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "การแจ้งเตือน — WK Health App" },
      { name: "description", content: "ตั้งค่าการแจ้งเตือนมื้ออาหาร น้ำดื่ม และ streak ให้เหมาะกับพฤติกรรมของคุณ" },
    ],
  }),
  component: NotificationsPage,
});

const TOGGLES = [
  { key: "mealReminder" as const, icon: Utensils, label: "เตือนมื้ออาหาร", desc: "แจ้งเมื่อใกล้เวลาที่คุณมักกินมื้อหลัก", tint: "bg-peach-soft text-peach" },
  { key: "waterReminder" as const, icon: Droplets, label: "เตือนดื่มน้ำ", desc: "แจ้งเป็นระยะเมื่อคุณดื่มน้ำน้อยกว่าเป้า", tint: "bg-sky-soft text-sky" },
  { key: "streakRisk" as const, icon: Flame, label: "เตือน streak จะขาด", desc: "แจ้งก่อนเที่ยงคืนถ้าวันนี้ยังไม่เช็คอิน", tint: "bg-mint-soft text-mint" },
  { key: "weeklyInsight" as const, icon: Sparkles, label: "Insight รายสัปดาห์พร้อมดู", desc: "แจ้งเมื่อ Coach AI วิเคราะห์สัปดาห์เสร็จ", tint: "bg-secondary text-secondary-foreground" },
];

function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const settings = useQuery({ queryKey: ["notifications", "settings"], queryFn: apiNotificationSettings, enabled: isAuthenticated });

  const update = useMutation({
    mutationFn: apiNotificationUpdate,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["notifications", "settings"] });
      const prev = qc.getQueryData(["notifications", "settings"]);
      qc.setQueryData(["notifications", "settings"], (old: any) => ({ ...old, ...patch }));
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications", "settings"], ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["notifications", "settings"] }),
  });

  const test = useMutation({ mutationFn: apiNotificationTest });

  const s = settings.data;

  if (settings.isLoading) {
    return (
      <div className="rise-in">
        <PageHeader title="การแจ้งเตือน" subtitle="ปรับให้เหมาะกับพฤติกรรมของคุณ" />
        <div className="space-y-2"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /></div>
      </div>
    );
  }
  if (settings.isError) {
    return (
      <div className="rise-in">
        <PageHeader title="การแจ้งเตือน" subtitle="ปรับให้เหมาะกับพฤติกรรมของคุณ" />
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      </div>
    );
  }

  return (
    <div className="rise-in">
      <PageHeader title="การแจ้งเตือน" subtitle="ปรับให้เหมาะกับพฤติกรรมของคุณ" />

      {/* smart timing */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display font-semibold"><Sparkles className="size-4 text-mint" /> Smart timing</p>
            <p className="mt-1 text-xs text-muted-foreground">ให้ AI เลือกเวลาที่เหมาะจากพฤติกรรมจริง แทนเวลาคงที่</p>
          </div>
          <Toggle checked={s?.smartTiming ?? false} onChange={(v) => update.mutate({ smartTiming: v })} />
        </div>
      </GlassCard>

      {/* toggles */}
      <section className="mt-4 space-y-2">
        {TOGGLES.map((t) => (
          <GlassCard key={t.key} className="flex items-center gap-3 p-4">
            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${t.tint}`}><t.icon className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.label}</p>
              <p className="truncate text-xs text-muted-foreground">{t.desc}</p>
            </div>
            <Toggle checked={Boolean(s?.[t.key])} onChange={(v) => update.mutate({ [t.key]: v })} />
          </GlassCard>
        ))}
      </section>

      {/* quiet hours */}
      <GlassCard className="mt-4 p-5">
        <p className="mb-3 flex items-center gap-2 font-display font-semibold"><Moon className="size-4" /> ช่วงเวลาห้ามรบกวน</p>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={s?.quietStart ?? "22:00"}
            onChange={(e) => update.mutate({ quietStart: e.target.value })}
            className="glass min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
          />
          <span className="text-xs text-muted-foreground">ถึง</span>
          <input
            type="time"
            value={s?.quietEnd ?? "07:00"}
            onChange={(e) => update.mutate({ quietEnd: e.target.value })}
            className="glass min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
          />
        </div>
      </GlassCard>

      <button
        onClick={() => test.mutate()}
        disabled={test.isPending}
        className="press glass-strong mt-6 flex w-full items-center justify-center gap-2 rounded-2xl p-4 font-display font-semibold shadow-soft disabled:opacity-60"
      >
        <Send className="size-4" />
        {test.isPending ? "กำลังส่ง…" : "ส่งแจ้งเตือนทดสอบ"}
      </button>
      {test.isSuccess && <p className="mt-2 text-center text-xs text-mint">ส่งแล้ว เช็คที่มือถือของคุณ</p>}
      {test.isError && <p className="mt-2 text-center text-xs text-destructive">ส่งไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`press relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-mint-gradient" : "bg-muted"}`}
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
