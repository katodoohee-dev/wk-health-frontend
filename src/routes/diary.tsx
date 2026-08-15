import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Keyboard, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader, GlassCard, Bar, Chip } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiDeleteDiary, apiDiary, apiStatsToday, todayISO } from "@/lib/api";

export const Route = createFileRoute("/diary")({
  head: () => ({
    meta: [
      { title: "ไดอารีการกิน — WK Health App" },
      { name: "description", content: "บันทึกมื้ออาหารรายวัน ดูแคลอรีและสารอาหารที่ได้รับในแต่ละมื้อ" },
      { property: "og:title", content: "ไดอารีการกิน — WK Health App" },
      { property: "og:description", content: "บันทึกมื้ออาหารรายวันพร้อมสรุปแคลอรีและสารอาหาร" },
    ],
  }),
  component: DiaryPage,
});

const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function weekDates(): Date[] {
  const now = new Date();
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return d;
  });
}

function DiaryPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const dates = weekDates();
  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState<string>("ทั้งหมด");

  const diary = useQuery({ queryKey: ["diary", date], queryFn: () => apiDiary(date), enabled: isAuthenticated });
  const stats = useQuery({ queryKey: ["stats", "today"], queryFn: apiStatsToday, enabled: isAuthenticated && date === todayISO() });

  const del = useMutation({
    mutationFn: (id: string) => apiDeleteDiary(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["diary"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const items = diary.data ?? [];
  const slots = Array.from(new Set(items.map((m) => m.slot))).filter(Boolean);
  const list = filter === "ทั้งหมด" ? items : items.filter((m) => m.slot === filter);
  const total = list.reduce((s, m) => s + m.kcal, 0);
  const s = stats.data;

  return (
    <div className="rise-in">
      <PageHeader title="ไดอารีการกิน" emoji="📔" subtitle={date} />

      <GlassCard className="p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {dates.map((d) => {
            const iso = todayISO(d);
            return (
              <button key={iso} onClick={() => setDate(iso)}
                className={`press flex flex-col items-center gap-1 rounded-2xl py-2 ${iso === date ? "bg-mint-gradient text-primary-foreground shadow-glow" : "bg-muted/60"}`}>
                <span className="text-[11px] opacity-80">{dayLabels[d.getDay()]}</span>
                <span className="font-display text-sm font-bold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0 space-y-2">
            <Bar label="โปรตีน" value={s?.protein ?? 0} max={s?.proteinGoal ?? 120} color="var(--mint)" />
            <Bar label="คาร์บ" value={s?.carb ?? 0} max={s?.carbGoal ?? 240} color="var(--sky)" />
            <Bar label="ไขมัน" value={s?.fat ?? 0} max={s?.fatGoal ?? 65} color="var(--peach)" />
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl font-bold tabular-nums text-primary">{total}</p>
            <p className="text-xs text-muted-foreground">/ {s?.goal ?? 2000} kcal</p>
          </div>
        </div>
      </GlassCard>

      {slots.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {["ทั้งหมด", ...slots].map((sl) => (<Chip key={sl} active={filter === sl} onClick={() => setFilter(sl)}>{sl}</Chip>))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {diary.isLoading ? (
          <><Skeleton className="h-[72px] w-full rounded-3xl" /><Skeleton className="h-[72px] w-full rounded-3xl" /><Skeleton className="h-[72px] w-full rounded-3xl" /></>
        ) : diary.isError ? (
          <ErrorState error={diary.error} onRetry={() => void diary.refetch()} />
        ) : list.length === 0 ? (
          <p className="glass-strong rounded-3xl p-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการในวันนี้</p>
        ) : (
          list.map((m) => (
            <div key={m.id} className="glass-strong group flex items-center gap-3 rounded-3xl p-3 shadow-soft">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-muted text-2xl">{m.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.slot} · {m.time} · P{m.protein} C{m.carb} F{m.fat}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display font-bold tabular-nums text-primary">{m.kcal}</p>
                <p className="text-[10px] text-muted-foreground">{m.source === "scan" ? "จากรูป" : m.source === "nlp" ? "จากข้อความ" : "เพิ่มเอง"}</p>
              </div>
              <button aria-label="ลบรายการ" onClick={() => del.mutate(m.id)} disabled={del.isPending}
                className="press grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                {del.isPending && del.variables === m.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </button>
            </div>
          ))
        )}
        {del.isError && <p className="rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{del.error instanceof Error ? del.error.message : "ลบรายการไม่สำเร็จ"}</p>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <QuickAdd icon={Camera} label="สแกนรูป" to="/scan" />
        <QuickAdd icon={Keyboard} label="พิมพ์ข้อความ" to="/nlp" />
        <QuickAdd icon={Plus} label="เพิ่มเอง" />
      </div>
    </div>
  );
}

function QuickAdd({ icon: Icon, label, to }: { icon: typeof Camera; label: string; to?: string }) {
  const cls = "press glass-strong flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-medium shadow-soft";
  const inner = (<><Icon className="size-5 text-primary" />{label}</>);
  if (to === "/scan" || to === "/nlp") return (<Link to={to} className={cls}>{inner}</Link>);
  return <button className={cls}>{inner}</button>;
}
