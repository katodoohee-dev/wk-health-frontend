import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Utensils, Droplets, Flame, Sparkles, Moon, Send, BellRing, BellOff, Loader2 } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import {
  apiNotificationSettings,
  apiNotificationUpdate,
  apiNotificationTest,
  apiNotificationVapidPublicKey,
  apiNotificationSubscribe,
  apiNotificationUnsubscribe,
} from "@/lib/api-new-features";

/** base64url VAPID public key -> ArrayBuffer ตามที่ pushManager.subscribe ต้องการ */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

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

  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // เช็คว่าเบราว์เซอร์รองรับ + subscribe ไว้แล้วหรือยังตอนเปิดหน้า
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPushSupported(true);
    void navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setPushSubscribed(Boolean(existing));
    }).catch(() => undefined);
  }, []);

  const enablePush = async () => {
    setPushError(null);
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushError("ต้องอนุญาตการแจ้งเตือนในเบราว์เซอร์ก่อนถึงจะเปิดใช้งานได้");
        return;
      }
      const { publicKey } = await apiNotificationVapidPublicKey();
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys?.["auth"]) throw new Error("อุปกรณ์นี้ไม่รองรับ push subscription ที่สมบูรณ์");
      await apiNotificationSubscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys["p256dh"], auth: json.keys["auth"] } });
      setPushSubscribed(true);
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "เปิดใช้งานการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushError(null);
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiNotificationUnsubscribe(sub.endpoint).catch(() => undefined);
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "ปิดการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setPushBusy(false);
    }
  };

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

      {/* เปิดใช้งาน push notification จริง — ต้องกดเองครั้งแรก (ขอ permission ของเบราว์เซอร์) */}
      {pushSupported ? (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-display font-semibold">
                {pushSubscribed ? <BellRing className="size-4 text-mint" /> : <BellOff className="size-4 text-muted-foreground" />}
                {pushSubscribed ? "เปิดใช้งานแจ้งเตือนแล้ว" : "ยังไม่ได้เปิดแจ้งเตือนขึ้นจอ"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pushSubscribed ? "อุปกรณ์นี้จะได้รับแจ้งเตือนจริงขึ้นจอ" : "กดเพื่ออนุญาตให้เบราว์เซอร์ส่งแจ้งเตือนขึ้นจอเครื่องนี้"}
              </p>
            </div>
            <button
              onClick={() => void (pushSubscribed ? disablePush() : enablePush())}
              disabled={pushBusy}
              className={`press shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-60 ${pushSubscribed ? "glass" : "bg-mint-gradient text-primary-foreground shadow-glow"}`}
            >
              {pushBusy ? <Loader2 className="size-4 animate-spin" /> : pushSubscribed ? "ปิด" : "เปิดใช้งาน"}
            </button>
          </div>
          {pushError && <p className="mt-2 text-xs text-destructive">{pushError}</p>}
        </GlassCard>
      ) : (
        <GlassCard className="flex items-center gap-3 p-4">
          <Bell className="size-5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">เบราว์เซอร์นี้ไม่รองรับ push notification (ลองเปิดในเบราว์เซอร์อื่นหรืออุปกรณ์อื่น)</p>
        </GlassCard>
      )}

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
      {test.isError && (
        <p className="mt-2 text-center text-xs text-destructive">
          {test.error instanceof Error ? test.error.message : "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง"}
        </p>
      )}
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
