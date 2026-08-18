import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Check,
  Flame,
  Heart,
  HeartPulse,
  Moon,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Watch,
  X,
} from "lucide-react";
import { PageHeader, GlassCard, SectionTitle } from "@/components/app/ui-bits";
import {
  connectHealthProvider,
  getStoredHealthConnections,
  syncHealthProvider,
  type HealthProvider,
  type HealthPermission,
  type HealthConnectionState,
  setStoredHealthConnections,
} from "@/lib/health-sync";

export const Route = createFileRoute("/device-connect")({
  head: () => ({
    meta: [
      { title: "เชื่อมต่ออุปกรณ์ — WK Health App" },
      { name: "description", content: "เชื่อมต่อข้อมูลสุขภาพและ wearable เข้ากับ WK Health" },
    ],
  }),
  component: DeviceConnectPage,
});

type PermissionKey = HealthPermission;

type Device = {
  id: HealthProvider;
  name: string;
  description: string;
  icon: typeof Heart;
  tint: string;
  permissions: Record<PermissionKey, boolean>;
};

type SyncLog = {
  id: string;
  deviceName: string;
  action: "connected" | "disconnected" | "synced" | "error";
  timestamp: string;
  records: number;
  message?: string;
};

const PERMISSION_LABELS: Record<PermissionKey, { label: string; icon: typeof Activity }> = {
  steps: { label: "ก้าวเดิน & กิจกรรม", icon: Activity },
  heartRate: { label: "อัตราการเต้นหัวใจ", icon: HeartPulse },
  sleep: { label: "การนอนหลับ", icon: Moon },
  weight: { label: "น้ำหนัก", icon: Scale },
};

const DEVICES: Device[] = [
  {
    id: "healthkit",
    name: "Apple HealthKit",
    description: "ซิงค์ก้าวเดิน การออกกำลังกาย หัวใจ และการนอนจาก iPhone",
    icon: Heart,
    tint: "bg-peach-soft text-peach",
    permissions: { steps: true, heartRate: true, sleep: true, weight: false },
  },
  {
    id: "health-connect",
    name: "Google Fit / Health Connect",
    description: "ดึงกิจกรรม ก้าว หัวใจ และการนอนจาก Android",
    icon: Flame,
    tint: "bg-sky-soft text-sky",
    permissions: { steps: true, heartRate: true, sleep: false, weight: false },
  },
  {
    id: "fitbit",
    name: "Fitbit",
    description: "นำเข้าก้าวเดิน การออกกำลังกาย ระยะการนอน และหัวใจ",
    icon: Watch,
    tint: "bg-mint-soft text-mint",
    permissions: { steps: true, heartRate: true, sleep: true, weight: false },
  },
  {
    id: "garmin",
    name: "Garmin",
    description: "ดึงข้อมูลการฝึกซ้อม การฟื้นตัว การนอน และองค์ประกอบร่างกาย",
    icon: Activity,
    tint: "bg-secondary text-secondary-foreground",
    permissions: { steps: true, heartRate: true, sleep: true, weight: true },
  },
];

const defaultLogs: SyncLog[] = [];

function nowLabel() {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(new Date());
}

function DeviceConnectPage() {
  const [connections, setConnections] = useState<Record<HealthProvider, HealthConnectionState>>(() => getStoredHealthConnections());
  const [logs, setLogs] = useState<SyncLog[]>(defaultLogs);
  const [pendingId, setPendingId] = useState<HealthProvider | null>(null);
  const [pendingPerms, setPendingPerms] = useState<Record<PermissionKey, boolean>>({ steps: false, heartRate: false, sleep: false, weight: false });
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingDevice = DEVICES.find((d) => d.id === pendingId) ?? null;
  const connectedCount = useMemo(() => Object.values(connections).filter((v) => v.connected).length, [connections]);

  useEffect(() => {
    setStoredHealthConnections(connections);
  }, [connections]);

  useEffect(() => {
    const onHealthEvent = (event: Event) => {
      const custom = event as CustomEvent<{ provider?: HealthProvider; connected?: boolean; records?: number; message?: string }>;
      const provider = custom.detail?.provider;
      if (!provider) return;
      const device = DEVICES.find((d) => d.id === provider);
      if (!device) return;
      const connected = Boolean(custom.detail?.connected);
      setConnections((prev) => ({
        ...prev,
        [provider]: {
          connected,
          permissions: prev[provider]?.permissions ?? device.permissions,
          lastSyncAt: connected ? new Date().toISOString() : prev[provider]?.lastSyncAt ?? null,
          records: Number(custom.detail?.records ?? prev[provider]?.records ?? 0),
        },
      }));
      setLogs((prev) => [{
        id: `${Date.now()}-${provider}`,
        deviceName: device.name,
        action: connected ? "connected" : "disconnected",
        timestamp: nowLabel(),
        records: Number(custom.detail?.records ?? 0),
        message: custom.detail?.message,
      }, ...prev].slice(0, 20));
    };
    window.addEventListener("wk:health-sync", onHealthEvent);
    return () => window.removeEventListener("wk:health-sync", onHealthEvent);
  }, []);

  function openConnect(device: Device) {
    setPendingId(device.id);
    setPendingPerms({ ...(connections[device.id]?.permissions ?? device.permissions) });
  }

  async function confirmConnect() {
    if (!pendingDevice) return;
    setBusyId(pendingDevice.id);
    try {
      const result = await connectHealthProvider(pendingDevice.id, pendingPerms);
      setConnections((prev) => ({
        ...prev,
        [pendingDevice.id]: {
          connected: true,
          permissions: pendingPerms,
          lastSyncAt: result.lastSyncAt ?? new Date().toISOString(),
          records: result.records ?? 0,
        },
      }));
      setLogs((prev) => [{
        id: `${Date.now()}`,
        deviceName: pendingDevice.name,
        action: "connected",
        timestamp: nowLabel(),
        records: result.records ?? 0,
        message: result.message,
      }, ...prev].slice(0, 20));
      setPendingId(null);
    } catch (error) {
      setLogs((prev) => [{
        id: `${Date.now()}`,
        deviceName: pendingDevice.name,
        action: "error",
        timestamp: nowLabel(),
        records: 0,
        message: error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ",
      }, ...prev].slice(0, 20));
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(device: Device) {
    setBusyId(device.id);
    try {
      const bridge = (window as any).wkHealthNative;
      if (bridge?.disconnect) await bridge.disconnect(device.id);
      setConnections((prev) => ({
        ...prev,
        [device.id]: { ...prev[device.id], connected: false },
      }));
      setLogs((prev) => [{
        id: `${Date.now()}`,
        deviceName: device.name,
        action: "disconnected",
        timestamp: nowLabel(),
        records: 0,
      }, ...prev].slice(0, 20));
    } finally {
      setBusyId(null);
    }
  }

  async function sync(device: Device) {
    setBusyId(device.id);
    try {
      const result = await syncHealthProvider(device.id);
      setConnections((prev) => ({
        ...prev,
        [device.id]: {
          ...(prev[device.id] ?? { connected: true, permissions: device.permissions }),
          connected: true,
          lastSyncAt: result.lastSyncAt ?? new Date().toISOString(),
          records: result.records ?? 0,
        },
      }));
      setLogs((prev) => [{ id: `${Date.now()}`, deviceName: device.name, action: "synced", timestamp: nowLabel(), records: result.records ?? 0, message: result.message }, ...prev].slice(0, 20));
    } catch (error) {
      setLogs((prev) => [{ id: `${Date.now()}`, deviceName: device.name, action: "error", timestamp: nowLabel(), records: 0, message: error instanceof Error ? error.message : "ซิงค์ไม่สำเร็จ" }, ...prev].slice(0, 20));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rise-in">
      <PageHeader title="เชื่อมต่ออุปกรณ์สุขภาพ" emoji="⌚" subtitle="เชื่อมข้อมูลจาก wearable และแอปสุขภาพ เพื่อวิเคราะห์ที่แม่นยำขึ้นและ insight ที่เป็นประโยชน์ต่อการดูแลตัวเอง" />

      <GlassCard className="mb-4 flex items-start gap-3 border border-amber-300/80 bg-amber-50/60 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">เว็บรุ่นนี้ใช้ Health Bridge</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Apple HealthKit และ Android Health Connect ต้องรับสิทธิ์ผ่านแอปมือถือ ส่วน Fitbit/Garmin ใช้ OAuth เมื่อฝั่งเซิร์ฟเวอร์เปิดใช้แล้ว</p>
        </div>
      </GlassCard>

      <SectionTitle title="อุปกรณ์ที่เชื่อมต่อได้" action={<span className={`rounded-full px-3 py-1 text-xs font-medium ${connectedCount ? "bg-mint text-white" : "bg-muted text-muted-foreground"}`}>{connectedCount}/{DEVICES.length} connected</span>} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DEVICES.map((device) => {
          const state = connections[device.id] ?? { connected: false, permissions: device.permissions, lastSyncAt: null, records: 0 };
          const busy = busyId === device.id;
          return (
            <GlassCard key={device.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${device.tint}`}><device.icon className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate font-display font-semibold">{device.name}</p><p className="line-clamp-2 text-xs text-muted-foreground">{device.description}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${state.connected ? "bg-mint text-white" : "border border-border bg-background/60 text-foreground"}`}>
                  {state.connected ? <><Check className="mr-1 inline size-3" />Connected</> : "Not Connected"}
                </span>
              </div>

              {state.connected ? (
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={busy} onClick={() => void sync(device)} className="press bg-mint-gradient flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium text-primary-foreground shadow-glow disabled:opacity-60"><RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> Sync</button>
                  <button disabled={busy} onClick={() => void disconnect(device)} className="press glass flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium disabled:opacity-60"><X className="size-3.5" /> Disconnect</button>
                </div>
              ) : (
                <button disabled={busy} onClick={() => openConnect(device)} className="press bg-mint-gradient flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium text-primary-foreground shadow-glow disabled:opacity-60"><Plus className="size-3.5" /> Connect</button>
              )}
              {state.connected && state.lastSyncAt && <p className="text-[11px] text-muted-foreground">ซิงค์ล่าสุด {new Date(state.lastSyncAt).toLocaleString("th-TH")} · {state.records.toLocaleString()} รายการ</p>}
            </GlassCard>
          );
        })}
      </div>

      {connectedCount === 0 && <GlassCard className="mt-4 flex flex-col items-center gap-2 border border-dashed p-8 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Shield className="size-5" /></span><p className="font-display font-semibold">ยังไม่ได้เชื่อมต่ออุปกรณ์</p><p className="max-w-xs text-xs text-muted-foreground">เชื่อมต่ออย่างน้อย 1 แหล่งข้อมูล เพื่อให้ WK Health รวมข้อมูลสุขภาพไปใช้กับก้าว, workout, route และ insight ได้</p></GlassCard>}

      <SectionTitle title="Sync Log" action={<button type="button" onClick={() => window.location.reload()} className="flex items-center gap-1 text-xs text-muted-foreground"><RefreshCw className="size-3.5" /> Refresh</button>} />
      <GlassCard className="divide-y divide-border/60 p-0">
        {logs.length === 0 ? <p className="p-4 text-center text-xs text-muted-foreground">ยังไม่มีประวัติการเชื่อมต่อในเซสชันนี้</p> : logs.map((log) => <div key={log.id} className="flex items-center gap-3 p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${log.action === "connected" ? "bg-mint-soft text-mint" : log.action === "disconnected" || log.action === "error" ? "bg-destructive/10 text-destructive" : "bg-sky-soft text-sky"}`}>{log.action === "connected" ? <Check className="size-4" /> : log.action === "disconnected" ? <X className="size-4" /> : <RefreshCw className="size-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{log.deviceName} {log.action === "connected" ? "เชื่อมต่อแล้ว" : log.action === "disconnected" ? "ยกเลิกการเชื่อมต่อ" : log.action === "synced" ? "ซิงค์ข้อมูลแล้ว" : "เกิดข้อผิดพลาด"}</p><p className="truncate text-xs text-muted-foreground">{log.records.toLocaleString()} รายการ · {log.timestamp}{log.message ? ` · ${log.message}` : ""}</p></div></div>)}
      </GlassCard>

      {pendingDevice && <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4" onClick={() => setPendingId(null)}><div className="glass-strong w-full max-w-md rounded-t-3xl p-6 shadow-soft sm:rounded-3xl" onClick={(e) => e.stopPropagation()}><span className="mb-3 grid size-10 place-items-center rounded-xl bg-mint-soft text-mint"><Shield className="size-5" /></span><p className="font-display text-lg font-semibold">อนุญาตให้เข้าถึงข้อมูล</p><p className="mt-1 text-xs text-muted-foreground">เลือกข้อมูลที่ต้องการให้ {pendingDevice.name} แชร์กับ WK Health</p><div className="mt-4 space-y-2">{(Object.keys(PERMISSION_LABELS) as PermissionKey[]).map((key) => { const Icon = PERMISSION_LABELS[key].icon; const checked = pendingPerms[key]; return <button key={key} type="button" onClick={() => setPendingPerms((prev) => ({ ...prev, [key]: !prev[key] }))} className={`glass flex w-full items-center gap-3 rounded-2xl p-3 text-left ${checked ? "ring-1 ring-mint/30" : ""}`}><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${checked ? "bg-mint-gradient text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="size-4" /></span><span className="min-w-0 flex-1 text-sm font-medium">{PERMISSION_LABELS[key].label}</span><span className={`grid size-5 shrink-0 place-items-center rounded-full border ${checked ? "border-mint bg-mint text-white" : "border-border"}`}>{checked ? <Check className="size-3.5" /> : null}</span></button>; })}</div><div className="mt-5 flex gap-2"><button onClick={() => setPendingId(null)} className="press glass flex-1 rounded-2xl py-3 text-sm font-medium">ยกเลิก</button><button onClick={() => void confirmConnect()} disabled={busyId === pendingDevice.id} className="press bg-mint-gradient flex-1 rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">{busyId === pendingDevice.id ? "กำลังเชื่อมต่อ…" : "ยืนยันเชื่อมต่อ"}</button></div></div></div>}
    </div>
  );
}
