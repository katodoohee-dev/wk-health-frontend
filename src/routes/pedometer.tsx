import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { Dumbbell, Flame, Footprints, Loader2, MapPin, Mountain, Navigation, Play, Plus, Route as RouteIcon, Square, Timer } from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PageHeader, GlassCard, Ring, SectionTitle } from "@/components/app/ui-bits";
import { ErrorState, LoadingState } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { gpsBridge } from "@/lib/gps-bridge";
import { apiPedometerLog, apiPedometerToday, apiRouteHistory, apiRouteStart, apiRouteStop, type GeoPoint } from "@/lib/api";

export const Route = createFileRoute("/pedometer")({
  head: () => ({
    meta: [
      { title: "นับก้าวเดิน — WK Health App" },
      { name: "description", content: "ติดตามจำนวนก้าว ระยะทาง แคลอรีที่เผาผลาญ และเส้นทาง GPS" },
    ],
  }),
  component: PedometerPage,
});

function PedometerPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [manualSteps, setManualSteps] = useState(1000);
  const q = useQuery({ queryKey: ["pedometer", "today"], queryFn: apiPedometerToday, enabled: isAuthenticated });
  const log = useMutation({
    mutationFn: (n: number) => apiPedometerLog(n),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pedometer"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  if (!isAuthenticated) return <GlassCard className="p-6 text-center text-sm text-muted-foreground">กรุณาเข้าสู่ระบบก่อนใช้งานหน้านี้</GlassCard>;
  if (q.isLoading) return <LoadingState label="กำลังโหลดข้อมูลก้าวเดิน…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const p = q.data;
  const pct = p.goal ? Math.round((p.steps / p.goal) * 100) : 0;

  return (
    <div className="rise-in">
      <PageHeader title="Pedometer" emoji="🚶" subtitle="ก้าวจริง + GPS จริง" />
      <GlassCard className="p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
          <Ring value={p.steps} max={p.goal} size={196} stroke={16} color="var(--sky)">
            <div><Footprints className="mx-auto size-6 text-sky" /><p className="font-display text-4xl font-bold tabular-nums">{p.steps.toLocaleString()}</p><p className="text-xs text-muted-foreground">จากเป้า {p.goal.toLocaleString()} ก้าว</p></div>
          </Ring>
          <div className="text-center sm:text-left"><p className="font-display text-2xl font-bold text-primary">{pct}%</p><p className="max-w-48 text-sm text-muted-foreground">เหลืออีก {Math.max(0, p.goal - p.steps).toLocaleString()} ก้าว สู้ ๆ นะ 💪</p></div>
        </div>
      </GlassCard>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={RouteIcon} label="ระยะทาง" value={`${p.distanceKm} กม.`} tint="bg-sky-soft text-sky" />
        <Stat icon={Flame} label="เผาผลาญ" value={`${p.kcal} kcal`} tint="bg-peach-soft text-peach" />
        <Stat icon={Timer} label="แอคทีฟ" value={`${p.activeMinutes} นาที`} tint="bg-mint-soft text-mint" />
        <Stat icon={Mountain} label="ขึ้นชั้น" value={`${p.floors} ชั้น`} tint="bg-secondary text-secondary-foreground" />
      </div>

      <GlassCard className="mt-4 p-4">
        <SectionTitle title="บันทึกก้าวเพิ่ม" />
        <div className="flex items-center gap-2">
          <input type="number" min={1} value={manualSteps} onChange={(e) => setManualSteps(Number(e.target.value))} className="glass min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none" aria-label="จำนวนก้าว" />
          <button onClick={() => manualSteps > 0 && log.mutate(manualSteps)} disabled={log.isPending} className="press bg-mint-gradient flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
            {log.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} บันทึก
          </button>
        </div>
        {log.isError && <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{log.error instanceof Error ? log.error.message : "บันทึกไม่สำเร็จ"}</p>}
        {log.isSuccess && <p className="mt-3 rounded-2xl bg-mint-soft px-3 py-2.5 text-sm text-mint">บันทึกก้าวเดินสำเร็จ ✓</p>}
      </GlassCard>

      <AutoStepCounter onLogged={() => void qc.invalidateQueries({ queryKey: ["pedometer"] })} />
      <GpsTracker />

      {p.hourly.length > 0 && <GlassCard className="mt-4 p-4"><SectionTitle title="ก้าวรายชั่วโมง" /><div className="h-44 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={p.hourly} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}><XAxis dataKey="h" tickLine={false} axisLine={false} fontSize={12} /><Bar dataKey="steps" fill="var(--sky)" radius={[8, 8, 8, 8]} /></BarChart></ResponsiveContainer></div></GlassCard>}
    </div>
  );
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function AutoStepCounter({ onLogged }: { onLogged: () => void }) {
  const [counting, setCounting] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const lastStepAt = useRef(0);
  const previous = useRef(0);
  const previousSlope = useRef(0);
  const gravity = useRef({ x: 0, y: 0, z: 0 });
  const noise = useRef(0);
  const samples = useRef(0);
  const calibrationUntil = useRef(0);
  const armed = useRef(false);
  const handler = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const log = useMutation({ mutationFn: (n: number) => apiPedometerLog(n, { seconds }), onSuccess: onLogged });

  useEffect(() => {
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") setSupported(false);
  }, []);
  useEffect(() => {
    if (!counting) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [counting]);

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const a = e.acceleration;
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null || g.z == null) return;

    let signal: number;
    if (a && a.x != null && a.y != null && a.z != null) {
      signal = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    } else {
      const alpha = 0.90;
      gravity.current.x = alpha * gravity.current.x + (1 - alpha) * g.x;
      gravity.current.y = alpha * gravity.current.y + (1 - alpha) * g.y;
      gravity.current.z = alpha * gravity.current.z + (1 - alpha) * g.z;
      const x = g.x - gravity.current.x;
      const y = g.y - gravity.current.y;
      const z = g.z - gravity.current.z;
      signal = Math.sqrt(x * x + y * y + z * z);
    }

    const smoothed = previous.current * 0.72 + signal * 0.28;
    const slope = smoothed - previous.current;
    const now = Date.now();

    if (now < calibrationUntil.current) {
      noise.current += smoothed;
      samples.current += 1;
      previous.current = smoothed;
      previousSlope.current = slope;
      return;
    }

    const noiseFloor = samples.current ? noise.current / samples.current : 0;
    const threshold = Math.max(1.15, noiseFloor + 0.75);
    const fallingPeak = previousSlope.current > 0 && slope <= 0;
    const amplitude = smoothed - noiseFloor;

    if (fallingPeak && amplitude >= threshold && armed.current && now - lastStepAt.current >= 450) {
      lastStepAt.current = now;
      armed.current = false;
      setLiveSteps((s) => s + 1);
    }
    if (smoothed <= noiseFloor + 0.25) armed.current = true;

    previous.current = smoothed;
    previousSlope.current = slope;
  }, []);

  const start = async () => {
    setError(null);
    try {
      const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
      if (typeof DME.requestPermission === "function") {
        const permission = await DME.requestPermission();
        if (permission !== "granted") throw new Error("ต้องอนุญาตเซ็นเซอร์การเคลื่อนไหวก่อน");
      }
      lastStepAt.current = 0;
      previous.current = 0;
      previousSlope.current = 0;
      gravity.current = { x: 0, y: 0, z: 0 };
      noise.current = 0;
      samples.current = 0;
      calibrationUntil.current = Date.now() + 1500;
      armed.current = false;
      setLiveSteps(0);
      setSeconds(0);
      handler.current = handleMotion;
      window.addEventListener("devicemotion", handleMotion, { passive: true });
      setCounting(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดเซ็นเซอร์ไม่สำเร็จ");
    }
  };

  const stop = () => {
    if (handler.current) window.removeEventListener("devicemotion", handler.current);
    handler.current = null;
    setCounting(false);
    if (liveSteps > 0) log.mutate(liveSteps);
  };

  useEffect(() => () => { if (handler.current) window.removeEventListener("devicemotion", handler.current); }, []);

  if (!supported) return <GlassCard className="mt-4 p-4"><SectionTitle title="นับก้าวอัตโนมัติ" /><p className="text-sm text-muted-foreground">อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับ DeviceMotion</p></GlassCard>;

  return <GlassCard className="mt-4 p-4">
    <SectionTitle title="นับก้าวอัตโนมัติ" />
    <div className="flex items-center gap-4">
      <span className={`grid size-14 shrink-0 place-items-center rounded-3xl ${counting ? "bg-sky-soft text-sky animate-pulse" : "bg-muted text-muted-foreground"}`}><Footprints className="size-6" /></span>
      <div className="min-w-0 flex-1"><p className="font-display text-3xl font-bold tabular-nums">{liveSteps.toLocaleString()} ก้าว</p><p className="truncate text-xs text-muted-foreground">{counting ? `กำลังนับ · ${fmtDuration(seconds)}` : "กดเริ่ม แล้วถือโทรศัพท์ติดตัวขณะเดิน"}</p></div>
      <button onClick={() => void (counting ? stop() : start())} disabled={log.isPending} className={`press flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-glow disabled:opacity-60 ${counting ? "bg-destructive text-destructive-foreground" : "bg-mint-gradient text-primary-foreground"}`}>{counting ? <Square className="size-4" /> : <Play className="size-4" />}{counting ? "หยุด & บันทึก" : "เริ่มนับ"}</button>
    </div>
    {error && <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}
  </GlassCard>;
}

type GpsPoint = GeoPoint & { timestamp: number; accuracy: number; speed: number; heading: number };

function distanceM(a: GeoPoint, b: GeoPoint) {
  const R = 6371000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function bearing(a: GeoPoint, b: GeoPoint) {
  const y = Math.sin(((b.lng - a.lng) * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) - Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lng - a.lng) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI + 360 % 360;
}

function angleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function smoothBearing(from: number, to: number, alpha = 0.28) {
  return (from + angleDelta(from, to) * alpha + 360) % 360;
}

const gpsArrow = L.divIcon({
  className: "!bg-transparent !border-0",
  iconSize: [58, 58],
  iconAnchor: [29, 29],
  html: `<div style="width:58px;height:58px;border-radius:50%;background:rgba(34,211,238,.16);display:grid;place-items:center"><div class="wk-gps-arrow" style="width:38px;height:38px;border-radius:50%;background:#22d3ee;color:#03131a;display:grid;place-items:center;box-shadow:0 3px 14px rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.88)"><span style="font-size:22px;line-height:1;font-weight:900">▲</span></div></div>`,
});

const startMarker = L.divIcon({
  className: "!bg-transparent !border-0",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#22d3ee;border:3px solid rgba(255,255,255,.92);box-shadow:0 2px 10px rgba(0,0,0,.5)"></div>`,
});

function FollowPosition({ position, heading }: { position: GpsPoint; heading: number }) {
  const map = useMap();
  useEffect(() => {
    const current = map.getCenter();
    const moved = distanceM({ lat: current.lat, lng: current.lng }, position);
    if (moved > 3) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.35 });
    }
    const el = document.querySelector<HTMLElement>(".wk-gps-arrow");
    if (el) el.style.transform = `rotate(${heading}deg)`;
  }, [map, position.lat, position.lng, heading]);
  return null;
}

function RouteMap({ points }: { points: GpsPoint[] }) {
  if (!points.length) return <div className="grid h-72 place-items-center rounded-3xl bg-[#07151b] text-sm text-slate-400">กำลังรอสัญญาณ GPS…</div>;
  const last = points[points.length - 1];
  const first = points[0];
  const positions = points.map((p) => [p.lat, p.lng] as [number, number]);
  return <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#07151b] shadow-[0_20px_60px_rgba(0,0,0,.45)]" style={{ height: 380 }}>
    <MapContainer center={[last.lat, last.lng]} zoom={17} scrollWheelZoom className="h-full w-full" zoomControl>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <Polyline positions={positions} pathOptions={{ color: "rgba(2,8,12,.85)", weight: 11, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
      <Polyline positions={positions} pathOptions={{ color: "#22d3ee", weight: 5, opacity: 0.98, lineCap: "round", lineJoin: "round", className: "wk-route-line" }} />
      <Marker position={[first.lat, first.lng]} icon={startMarker} />
      <Marker position={[last.lat, last.lng]} icon={gpsArrow} />
      <FollowPosition position={last} heading={last.heading} />
    </MapContainer>
  </div>;
}

function GpsTracker() {
  const qc = useQueryClient();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastRef = useRef<GpsPoint | null>(null);
  const headingRef = useRef(0);
  const history = useQuery({ queryKey: ["route", "history"], queryFn: apiRouteHistory });

  const stop = useCallback(async () => {
    const id = routeId;
    if (!id) return;
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setBusy(true);
    try {
      await apiRouteStop({ routeId: id, path: points.map((p) => ({ lat: p.lat, lng: p.lng })), durationSeconds: seconds });
      void qc.invalidateQueries({ queryKey: ["route"] });
      void qc.invalidateQueries({ queryKey: ["pedometer"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกเส้นทางไม่สำเร็จ");
    } finally {
      setBusy(false);
      setRouteId(null);
    }
  }, [routeId, points, seconds, qc]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.geolocation) { setError("อุปกรณ์นี้ไม่รองรับ GPS"); return; }
    try {
      setBusy(true);
      const id = await apiRouteStart();
      setRouteId(id || "temp");
      setSeconds(0);
      setPoints([]);
      lastRef.current = null;
      headingRef.current = 0;
      watchRef.current = navigator.geolocation.watchPosition((pos) => {
        const accuracy = pos.coords.accuracy ?? 999;
        if (!Number.isFinite(accuracy) || accuracy > 50) return;
        const nextBase = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const previous = lastRef.current;
        if (previous) {
          const d = distanceM(previous, nextBase);
          const dt = Math.max(0.25, (pos.timestamp - previous.timestamp) / 1000);
          if (d < Math.max(2.5, Math.min(6, accuracy * 0.08))) return;
          const impliedSpeed = d / dt;
          const gpsSpeed = pos.coords.speed != null && Number.isFinite(pos.coords.speed) && pos.coords.speed >= 0 ? pos.coords.speed : impliedSpeed;
          const accuracyJumpLimit = Math.max(45, previous.accuracy + accuracy * 1.5);
          if (d > accuracyJumpLimit && impliedSpeed > 11) return;
          if (impliedSpeed > 14) return;
          const rawHeading = d > 3 ? bearing(previous, nextBase) : (pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : headingRef.current);
          if (d > 3 && impliedSpeed > 0.8) headingRef.current = smoothBearing(headingRef.current, rawHeading, 0.32);
          const point: GpsPoint = {
            ...nextBase,
            timestamp: pos.timestamp,
            accuracy,
            speed: Math.min(gpsSpeed, 14),
            heading: headingRef.current,
          };
          lastRef.current = point;
          setPoints((current) => [...current, point]);
        } else {
          const initialHeading = pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : 0;
          const point: GpsPoint = {
            ...nextBase,
            timestamp: pos.timestamp,
            accuracy,
            speed: Math.max(0, pos.coords.speed ?? 0),
            heading: initialHeading,
          };
          headingRef.current = initialHeading;
          lastRef.current = point;
          setPoints([point]);
        }
      }, (err) => setError(err.code === err.PERMISSION_DENIED ? "กรุณาอนุญาต GPS" : "ไม่สามารถอ่านตำแหน่ง GPS ได้"), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "เริ่มติดตาม GPS ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { gpsBridge.register({ start, stop }); return () => gpsBridge.unregister(); }, [start, stop]);
  useEffect(() => { if (!routeId) return; const id = window.setInterval(() => setSeconds((s) => s + 1), 1000); return () => window.clearInterval(id); }, [routeId]);
  useEffect(() => () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); }, []);

  const distanceKm = useMemo(() => points.slice(1).reduce((sum, p, i) => sum + distanceM(points[i], p) / 1000, 0), [points]);
  const last = points[points.length - 1];

  return <>
    <GlassCard className="mt-4 p-5">
      <SectionTitle title="เดิน/วิ่ง GPS แบบสด" action={<Link to="/workout" className="flex items-center gap-1 text-xs font-medium text-primary"><Dumbbell className="size-3.5" /> ออกกำลังกาย</Link>} />
      <div className="flex items-center gap-4">
        <span className={`grid size-14 shrink-0 place-items-center rounded-3xl ${routeId ? "bg-mint-soft text-mint animate-pulse" : "bg-muted text-muted-foreground"}`}><MapPin className="size-6" /></span>
        <div className="min-w-0 flex-1"><p className="font-display text-3xl font-bold tabular-nums">{fmtDuration(seconds)}</p><p className="truncate text-xs text-muted-foreground">{routeId ? `GPS ${points.length} จุด · ${distanceKm.toFixed(2)} กม.` : "กดเริ่มเพื่อเริ่มติดตามตำแหน่ง"}</p></div>
        <button onClick={() => void (routeId ? stop() : start())} disabled={busy} className={`press flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-glow disabled:opacity-60 ${routeId ? "bg-destructive text-destructive-foreground" : "bg-mint-gradient text-primary-foreground"}`}>{busy ? <Loader2 className="size-4 animate-spin" /> : routeId ? <Square className="size-4" /> : <Play className="size-4" />}{routeId ? "หยุด" : "เริ่ม"}</button>
      </div>
      {last && <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground"><Navigation className="size-4 text-sky" /> ความแม่นยำ {Math.round(last.accuracy)} ม. · ความเร็ว {(last.speed * 3.6).toFixed(1)} กม./ชม.</div>}
      {error && <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}
      {routeId && <div className="mt-4"><RouteMap points={points} /></div>}
    </GlassCard>

    <GlassCard className="mt-4 p-4">
      <SectionTitle title="ประวัติเส้นทาง" />
      {history.isLoading ? <p className="text-sm text-muted-foreground">กำลังโหลด…</p> : history.data?.length ? <div className="space-y-2">{history.data.map((r) => <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2"><RouteIcon className="size-4 shrink-0 text-sky" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.distanceKm.toFixed(2)} กม.</p><p className="truncate text-xs text-muted-foreground">{r.date} · {fmtDuration(r.durationSeconds)}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums text-peach">{r.kcal} kcal</span></div>)}</div> : <p className="text-sm text-muted-foreground">ยังไม่มีเส้นทางที่บันทึกไว้</p>}
    </GlassCard>
  </>;
}

function Stat({ icon: Icon, label, value, tint }: { icon: typeof Flame; label: string; value: string; tint: string }) {
  return <div className="glass-strong rounded-3xl p-4 shadow-soft"><span className={`grid size-10 place-items-center rounded-2xl ${tint}`}><Icon className="size-5" /></span><p className="mt-2 truncate font-display font-bold tabular-nums">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>;
}
