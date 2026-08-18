export type HealthProvider = "healthkit" | "health-connect" | "fitbit" | "garmin";
export type HealthPermission = "steps" | "heartRate" | "sleep" | "weight";

export type HealthConnectionState = {
  connected: boolean;
  permissions: Record<HealthPermission, boolean>;
  lastSyncAt: string | null;
  records: number;
};

type ConnectResult = {
  connected: boolean;
  lastSyncAt: string | null;
  records: number;
  message?: string;
};

type NativeHealthBridge = {
  connect?: (payload: { provider: HealthProvider; permissions: Record<HealthPermission, boolean> }) => Promise<ConnectResult | void> | ConnectResult | void;
  disconnect?: (provider: HealthProvider) => Promise<void> | void;
  sync?: (provider: HealthProvider) => Promise<ConnectResult | void> | ConnectResult | void;
};

const STORAGE_KEY = "wk_health_connections_v1";

const emptyState = (): Record<HealthProvider, HealthConnectionState> => ({
  healthkit: { connected: false, permissions: { steps: false, heartRate: false, sleep: false, weight: false }, lastSyncAt: null, records: 0 },
  "health-connect": { connected: false, permissions: { steps: false, heartRate: false, sleep: false, weight: false }, lastSyncAt: null, records: 0 },
  fitbit: { connected: false, permissions: { steps: false, heartRate: false, sleep: false, weight: false }, lastSyncAt: null, records: 0 },
  garmin: { connected: false, permissions: { steps: false, heartRate: false, sleep: false, weight: false }, lastSyncAt: null, records: 0 },
});

function nativeBridge(): NativeHealthBridge | null {
  if (typeof window === "undefined") return null;
  return ((window as any).wkHealthNative as NativeHealthBridge | undefined) ?? null;
}

export function getStoredHealthConnections(): Record<HealthProvider, HealthConnectionState> {
  if (typeof window === "undefined") return emptyState();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return parsed ? { ...emptyState(), ...parsed } : emptyState();
  } catch {
    return emptyState();
  }
}

export function setStoredHealthConnections(value: Record<HealthProvider, HealthConnectionState>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage is best-effort; the native app/backend remain the source of truth.
  }
}

function dispatch(provider: HealthProvider, connected: boolean, records = 0, message?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wk:health-sync", { detail: { provider, connected, records, message } }));
}

export async function connectHealthProvider(
  provider: HealthProvider,
  permissions: Record<HealthPermission, boolean>,
): Promise<ConnectResult> {
  const bridge = nativeBridge();

  if (bridge?.connect) {
    const result = await bridge.connect({ provider, permissions });
    const normalized: ConnectResult = {
      connected: result?.connected ?? true,
      lastSyncAt: result?.lastSyncAt ?? new Date().toISOString(),
      records: result?.records ?? 0,
      message: result?.message,
    };
    dispatch(provider, normalized.connected, normalized.records, normalized.message);
    return normalized;
  }

  // OAuth providers can be wired to backend-generated authorization URLs.
  const oauthUrl = provider === "fitbit" ? import.meta.env.VITE_FITBIT_OAUTH_URL : provider === "garmin" ? import.meta.env.VITE_GARMIN_OAUTH_URL : undefined;
  if (oauthUrl) {
    window.location.assign(oauthUrl);
    return { connected: false, lastSyncAt: null, records: 0, message: "กำลังเปิดหน้าล็อกอินของผู้ให้บริการ…" };
  }

  if (provider === "healthkit") {
    throw new Error("Apple HealthKit ต้องเชื่อมผ่านแอป WK Health บน iPhone/iPad");
  }
  if (provider === "health-connect") {
    throw new Error("Health Connect ต้องเชื่อมผ่านแอป WK Health บน Android");
  }
  throw new Error("ยังไม่ได้ตั้งค่า Health Bridge/OAuth สำหรับผู้ให้บริการนี้");
}

export async function syncHealthProvider(provider: HealthProvider): Promise<ConnectResult> {
  const bridge = nativeBridge();
  if (!bridge?.sync) {
    throw new Error("ยังไม่ได้เปิด Health Bridge สำหรับการซิงค์ข้อมูลจริง");
  }
  const result = await bridge.sync(provider);
  const normalized: ConnectResult = {
    connected: result?.connected ?? true,
    lastSyncAt: result?.lastSyncAt ?? new Date().toISOString(),
    records: result?.records ?? 0,
    message: result?.message,
  };
  dispatch(provider, normalized.connected, normalized.records, normalized.message);
  return normalized;
}
