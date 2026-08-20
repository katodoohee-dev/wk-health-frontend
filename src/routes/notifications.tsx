import { createFileRoute } from "@tanstack/react-router";
import { Bell, Droplets, Flame, Moon, Send, Sparkles, Utensils } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { Chip, Eyebrow, Panel, SectionHeader, SuccessState } from "@/components/app/lovable-primitives";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiNotificationSettings, apiNotificationTest, apiNotificationUpdate } from "@/lib/api-new-features";

export const Route = createFileRoute("/notifications")({ head: () => ({ meta: [{ title: "Notifications — WK Health" }, { name: "description", content: "การแจ้งเตือนสุขภาพแบบปรับตามพฤติกรรม" }] }), component: NotificationsPage });

const TOGGLES = [
  { key: "mealReminder" as const, icon: Utensils, label: "Meal reminders", desc: "Notify around the times you usually eat." },
  { key: "waterReminder" as const, icon: Droplets, label: "Water reminders", desc: "Gentle reminders when hydration trails your target." },
  { key: "streakRisk" as const, icon: Flame, label: "Streak risk", desc: "Warn before the day closes without a check-in." },
  { key: "weeklyInsight" as const, icon: Sparkles, label: "Weekly insight", desc: "Notify when your weekly AI summary is ready." },
];

function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["notifications", "settings"], queryFn: apiNotificationSettings, enabled: isAuthenticated });
  const update = useMutation({ mutationFn: apiNotificationUpdate, onMutate: async (patch) => { await qc.cancelQueries({ queryKey: ["notifications", "settings"] }); const prev = qc.getQueryData(["notifications", "settings"]); qc.setQueryData(["notifications", "settings"], (old: any) => ({ ...old, ...patch })); return { prev }; }, onError: (_e, _p, ctx) => { if (ctx?.prev) qc.setQueryData(["notifications", "settings"], ctx.prev); }, onSettled: () => void qc.invalidateQueries({ queryKey: ["notifications", "settings"] }) });
  const test = useMutation({ mutationFn: apiNotificationTest });
  const s = settings.data;

  return <AppShell><div className="rise-in pb-10">
    <header className="border-b border-border py-7 sm:py-9"><div className="flex flex-wrap items-end justify-between gap-5"><div><Eyebrow>Timeline · delivery</Eyebrow><h1 className="display mt-2 text-3xl sm:text-4xl">Notifications</h1><p className="mt-2 text-sm text-muted-foreground">การแจ้งเตือนที่สงบ อ่านง่าย และควบคุมได้</p></div><Chip tone="signal">Quiet by default</Chip></div></header>
    {settings.isLoading ? <div className="space-y-2 py-7"><Skeleton className="h-20 w-full rounded-2xl"/><Skeleton className="h-20 w-full rounded-2xl"/></div> : settings.isError ? <div className="py-7"><ErrorState error={settings.error} onRetry={()=>void settings.refetch()}/></div> : <>
      <section className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)]">
        <Panel className="grain"><div className="flex items-start justify-between gap-5"><div><Eyebrow>Smart timing</Eyebrow><p className="display mt-2 text-2xl">Let WK choose the moment</p><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">ระบบจะเลือกจังหวะตามพฤติกรรมจริง แทนการแจ้งเตือนแบบตายตัว</p></div><Toggle checked={Boolean(s?.smartTiming)} onChange={(v)=>update.mutate({smartTiming:v})}/></div><div className="mt-8 border-t border-border pt-5"><div className="flex items-center gap-2 text-sm"><Bell className="size-4"/> Notifications stay secondary to your health context.</div></div></Panel>
        <Panel className="flex flex-col justify-between gap-6"><div><Eyebrow>Quiet hours</Eyebrow><p className="display mt-2 text-3xl">22:00 — {s?.quietEnd ?? "07:00"}</p><p className="mt-2 text-sm text-muted-foreground">ช่วงเวลาที่ระบบจะเก็บสัญญาณไม่เร่งด่วนไว้</p></div><Moon className="size-5 text-muted-foreground"/></Panel>
      </section>

      <section className="py-2"><SectionHeader eyebrow="Signals" title="Notification channels"/><div className="mt-2 divide-y divide-border">{TOGGLES.map(t=>{const Icon=t.icon;return <div key={t.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-5"><span className="grid size-10 place-items-center rounded-xl border border-border"><Icon className="size-4"/></span><div className="min-w-0"><p className="text-sm font-medium">{t.label}</p><p className="mt-1 text-xs text-muted-foreground">{t.desc}</p></div><Toggle checked={Boolean(s?.[t.key])} onChange={(v)=>update.mutate({[t.key]:v})}/></div>})}</div></section>

      <section className="py-7"><SectionHeader eyebrow="Do not disturb" title="Quiet hours"/><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><input type="time" value={s?.quietStart??"22:00"} onChange={e=>update.mutate({quietStart:e.target.value})} className="min-h-11 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none"/><span className="text-xs text-muted-foreground">to</span><input type="time" value={s?.quietEnd??"07:00"} onChange={e=>update.mutate({quietEnd:e.target.value})} className="min-h-11 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none"/></div></section>

      <section className="border-t border-border py-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><Eyebrow>System check</Eyebrow><p className="mt-1 text-sm text-muted-foreground">ส่งการแจ้งเตือนทดลองไปยังอุปกรณ์ที่เชื่อมต่อ</p></div><button onClick={()=>test.mutate()} disabled={test.isPending} className="press flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-50"><Send className="size-4"/>{test.isPending?"Sending…":"Send test"}</button></div>{test.isSuccess?<div className="mt-4"><SuccessState title="Notification sent" body="ตรวจสอบอุปกรณ์ที่เชื่อมต่อของคุณได้เลย"/></div>:null}{test.isError?<p className="mt-4 text-sm text-destructive">ส่งไม่สำเร็จ ลองใหม่อีกครั้ง</p>:null}</section>
    </>}
  </div></AppShell>;
}
function Toggle({checked,onChange}:{checked:boolean;onChange:(v:boolean)=>void}){return <button type="button" role="switch" aria-checked={checked} onClick={()=>onChange(!checked)} className={`press relative h-7 w-12 shrink-0 rounded-full border ${checked?"border-foreground bg-foreground":"border-border bg-surface-2"}`}><span className={`absolute top-1 size-5 rounded-full transition-transform ${checked?"translate-x-6 bg-background":"translate-x-1 bg-border-strong"}`}/></button>}
