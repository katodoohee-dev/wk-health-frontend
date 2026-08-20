import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Bluetooth,
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

export const Route = createFileRoute("/device-connect")({
  head: () => ({
    meta: [
      { title: "เชื่อมต่ออุปกรณ์ — WK Health App" },
      { name: "description", content: "เชื่อมต่อ Apple HealthKit, Google Fit, Fitbit และ Garmin เพื่อข้อมูลสุขภาพที่แม่นยำขึ้น" },
    ],
  }),
  component: DeviceConnectPage,
});

type PermissionKey = "steps" | "heartRate" | "sleep" | "weight";

type Device = {
  id: string;
  name: string;
  description: string;
  icon: typeof Heart;
  tint: string;
  connected: boolean;
  permissions: Record<PermissionKey, boolean>;
};

type SyncLog = {
  id: string;
  deviceName: string;
  action: "connected" | "disconnected" | "synced";
  timestamp: string;
  records: number;
};

const PERMISSION_LABELS: Record<PermissionKey, { label: string; icon: typeof Activity }> = {
  steps: { label: "ก้าวเดิน & กิจกรรม", icon: Activity },
  heartRate: { label: "อัตราการเต้นหัวใจ", icon: HeartPulse },
  sleep: { label: "การนอนหลับ", icon: Moon },
  weight: { label: "น้ำหนัก", icon: Scale },
};

const INITIAL_DEVICES: Device[] = [
  {
    id: "healthkit",
    name: "Apple HealthKit",
    description: "ซิงค์ก้าวเดิน การออกกำลังกาย หัวใจ และการนอนจาก iPhone",
    icon: Heart,
    tint: "bg-peach-soft text-peach",
    connected: false,
    permissions: { steps: true, heartRate: true, sleep: true, weight: false },
  },
  {
    id: "googlefit",
    name: "Google Fit",
    description: "ดึงกิจกรรม heart points และการนอนจากอุปกรณ์ Android",
    icon: Flame,
    tint: "bg-sky-soft text-sky",
    connected: false,
    permissions: { steps: true, heartRate: true, sleep: false, weight: false },
  },
  {
    id: "fitbit",
    name: "Fitbit",
    description: "นำเข้าก้าวเดิน การออกกำลังกาย ระยะการนอน และหัวใจ",
    icon: Watch,
    tint: "bg-mint-soft text-mint",
    connected: false,
    permissions: { steps: true, heartRate: true, sleep: true, weight: false },
  },
  {
    id: "garmin",
    name: "Garmin",
    description: "ดึงข้อมูลการฝึกซ้อม การฟื้นตัว การนอน และองค์ประกอบร่างกาย",
    icon: Activity,
    tint: "bg-secondary text-secondary-foreground",
    connected: false,
    permissions: { steps: true, heartRate: true, sleep: true, weight: true },
  },
];

const INITIAL_LOGS: SyncLog[] = [
  { id: "1", deviceName: "Fitbit", action: "synced", timestamp: "วันนี้ 08:14", records: 124 },
  { id: "2", deviceName: "Apple HealthKit", action: "synced", timestamp: "เมื่อวาน 22:03", records: 86 },
];

function DeviceConnectPage() {
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [logs, setLogs] = useState<SyncLog[]>(INITIAL_LOGS);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingPerms, setPendingPerms] = useState<Record<PermissionKey, boolean>>({
    steps: false, heartRate: false, sleep: false, weight: false,
  });

  const connectedCount = useMemo(() => devices.filter((d) => d.connected).length, [devices]);
  const pendingDevice = devices.find((d) => d.id === pendingId) ?? null;

  function openConnect(device: Device) {
    setPendingId(device.id);
    setPendingPerms({ ...device.permissions });
  }

  function confirmConnect() {
    if (!pendingDevice) return;
    const granted = Object.values(pendingPerms).filter(Boolean).length;
    setDevices((prev) => prev.map((d) => (d.id === pendingDevice.id ? { ...d, connected: true, permissions: pendingPerms } : d)));
    setLogs((prev) => [{ id: `${Date.now()}`, deviceName: pendingDevice.name, action: "connected", timestamp: "เมื่อสักครู่", records: granted }, ...prev]);
    setPendingId(null);
  }

  function disconnect(device: Device) {
    setDevices((prev) => prev.map((d) => (d.id === device.id ? { ...d, connected: false } : d)));
    setLogs((prev) => [{ id: `${Date.now()}`, deviceName: device.name, action: "disconnected", timestamp: "เมื่อสักครู่", records: 0 }, ...prev]);
  }

  return (
    <div className="rise-in">
      <PageHeader title="เชื่อมต่ออุปกรณ์" emoji="⌚" subtitle="ข้อมูลจากอุปกรณ์จริงช่วยให้ insight แม่นยำขึ้น" />

      {/* mockup warning banner */}
      <GlassCard className="mb-4 flex items-start gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-peach-soft text-peach">
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">นี่คือ UI จำลองเท่านั้น</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            การเชื่อมต่อจริงกับ Apple HealthKit / Google Fit ต้องทำผ่านแอปมือถือ (iOS/Android native) — เว็บไม่สามารถเชื่อมต่อโดยตรงได้
          </p>
        </div>
      </GlassCard>

      <SectionTitle
        title="อุปกรณ์ที่เชื่อมต่อได้"
        action={
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {connectedCount}/{devices.length} เชื่อมแล้ว
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {devices.map((device) => (
          <GlassCard key={device.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${device.tint}`}>
                <device.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold">{device.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{device.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${device.connected ? "bg-mint-soft text-mint" : "bg-muted text-muted-foreground"}`}>
                {device.connected ? <Check className="size-3" /> : null}
                {device.connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}
              </span>

              {device.connected ? (
                <button
                  onClick={() => disconnect(device)}
                  className="press glass flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium"
                >
                  <X className="size-3.5" /> ยกเลิก
                </button>
              ) : (
                <button
                  onClick={() => openConnect(device)}
                  className="press bg-mint-gradient flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-primary-foreground shadow-glow"
                >
                  <Plus className="size-3.5" /> เชื่อมต่อ
                </button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      {connectedCount === 0 && (
        <GlassCard className="mt-4 flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Shield className="size-5" />
          </span>
          <p className="font-display font-semibold">ยังไม่ได้เชื่อมต่ออุปกรณ์</p>
          <p className="max-w-xs text-xs text-muted-foreground">เชื่อมต่ออุปกรณ์อย่างน้อย 1 ชิ้น เพื่อให้แอปวิเคราะห์ข้อมูลสุขภาพของคุณได้แม่นยำขึ้น</p>
        </GlassCard>
      )}

      <SectionTitle title="ประวัติการซิงค์" action={<RefreshCw className="size-4 text-muted-foreground" />} />
      <GlassCard className="divide-y divide-border/60 p-0">
        {logs.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">ยังไม่มีประวัติ</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 p-4">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${log.action === "connected" ? "bg-mint-soft text-mint" : log.action === "disconnected" ? "bg-destructive/10 text-destructive" : "bg-sky-soft text-sky"}`}>
                {log.action === "connected" ? <Check className="size-4" /> : log.action === "disconnected" ? <X className="size-4" /> : <RefreshCw className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {log.action === "connected" && `${log.deviceName} เชื่อมต่อแล้ว`}
                  {log.action === "disconnected" && `${log.deviceName} ยกเลิกการเชื่อมต่อ`}
                  {log.action === "synced" && `${log.deviceName} ซิงค์ข้อมูลแล้ว`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {log.action === "synced" ? `${log.records} รายการ` : `${log.records} สิทธิ์ที่อนุญาต`} · {log.timestamp}
                </p>
              </div>
            </div>
          ))
        )}
      </GlassCard>

      {/* permission sheet */}
      {pendingDevice && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4" onClick={() => setPendingId(null)}>
          <div
            className="glass-strong w-full max-w-md rounded-t-3xl p-6 shadow-soft sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mb-3 grid size-10 place-items-center rounded-xl bg-mint-soft text-mint">
              <Shield className="size-5" />
            </span>
            <p className="font-display text-lg font-semibold">อนุญาตให้เข้าถึงข้อมูล</p>
            <p className="mt-1 text-xs text-muted-foreground">เลือกข้อมูลที่ต้องการให้ {pendingDevice.name} แชร์ (จำลองเท่านั้น)</p>

            <div className="mt-4 space-y-2">
              {(Object.keys(PERMISSION_LABELS) as PermissionKey[]).map((key) => {
                const Icon = PERMISSION_LABELS[key].icon;
                const checked = pendingPerms[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPendingPerms((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left"
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${checked ? "bg-mint-gradient text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium">{PERMISSION_LABELS[key].label}</span>
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${checked ? "border-mint bg-mint text-white" : "border-border"}`}>
                      {checked ? <Check className="size-3.5" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setPendingId(null)} className="press glass flex-1 rounded-2xl py-3 text-sm font-medium">
                ยกเลิก
              </button>
              <button onClick={confirmConnect} className="press bg-mint-gradient flex-1 rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow">
                ยืนยันเชื่อมต่อ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
