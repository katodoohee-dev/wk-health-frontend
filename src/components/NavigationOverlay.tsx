import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, LocateFixed, Navigation, Volume2, X } from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLng = { lat: number; lng: number };
type RouteStep = { distance: number; duration: number; name?: string; maneuver?: { type?: string; modifier?: string }; geometry?: { coordinates?: [number, number][] } };
type RoutePlan = { geometry: [number, number][]; distance: number; duration: number; steps: RouteStep[]; destination: LatLng; label: string };
type NavRequest = { destination: string; milestoneKm?: number | null; announceTurns?: boolean };

const ROUTER = import.meta.env.VITE_ROUTING_API_URL || "https://router.project-osrm.org";
const GEOCODER = import.meta.env.VITE_GEOCODER_URL || "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const DEFAULT_CENTER: LatLng = { lat: 13.7563, lng: 100.5018 };
const MAX_ACCURACY_M = 50;
const MAX_SPEED_MPS = 12;
const REROUTE_OFF_ROUTE_M = 70;
const REROUTE_COOLDOWN_MS = 20_000;
const TURN_ANNOUNCE_M = 60;
const ARRIVAL_M = 25;

const currentIcon = L.divIcon({ className: "!bg-transparent !border-0", iconSize: [54, 54], iconAnchor: [27, 27], html: `<div style="width:54px;height:54px;border-radius:50%;background:rgba(45,212,191,.18);display:grid;place-items:center"><div style="width:36px;height:36px;border-radius:50%;background:#14b8a6;color:white;display:grid;place-items:center;box-shadow:0 3px 16px rgba(0,0,0,.35)"><span style="font-size:22px;line-height:1">▲</span></div></div>` });
const destinationIcon = L.divIcon({ className: "!bg-transparent !border-0", iconSize: [44, 54], iconAnchor: [22, 50], html: `<div style="width:44px;height:54px;display:grid;place-items:center"><div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#fb7185;box-shadow:0 4px 16px rgba(0,0,0,.35);display:grid;place-items:center"><span style="transform:rotate(45deg);color:white;font-size:18px">●</span></div></div>` });

function distanceM(a: LatLng, b: LatLng) {
  const R = 6371000;
  const p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function projectPoint(p: LatLng, a: LatLng, b: LatLng) {
  const latScale = 111320;
  const lngScale = Math.max(1, 111320 * Math.cos(p.lat * Math.PI / 180));
  const ax = (a.lng - p.lng) * lngScale, ay = (a.lat - p.lat) * latScale;
  const bx = (b.lng - p.lng) * lngScale, by = (b.lat - p.lat) * latScale;
  const dx = bx - ax, dy = by - ay;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((-ax) * dx + (-ay) * dy) / (dx * dx + dy * dy)));
  return { t, point: { lat: p.lat + (ay + dy * t) / latScale, lng: p.lng + (ax + dx * t) / lngScale } };
}

function closestRoutePoint(route: [number, number][], point: LatLng) {
  let best = { distance: Number.POSITIVE_INFINITY, index: 0, t: 0 };
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = { lat: route[i][0], lng: route[i][1] }, b = { lat: route[i + 1][0], lng: route[i + 1][1] };
    const projected = projectPoint(point, a, b);
    const d = distanceM(point, projected.point);
    if (d < best.distance) best = { distance: d, index: i, t: projected.t };
  }
  return best;
}

function remainingRouteM(route: [number, number][], point: LatLng) {
  if (route.length < 2) return 0;
  const nearest = closestRoutePoint(route, point);
  const a = { lat: route[nearest.index][0], lng: route[nearest.index][1] };
  const b = { lat: route[nearest.index + 1][0], lng: route[nearest.index + 1][1] };
  const projected = projectPoint(point, a, b).point;
  let remaining = distanceM(projected, b);
  for (let i = nearest.index + 1; i < route.length - 1; i += 1) {
    remaining += distanceM({ lat: route[i][0], lng: route[i][1] }, { lat: route[i + 1][0], lng: route[i + 1][1] });
  }
  return remaining;
}

function formatKm(meters: number) { return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} กม.` : `${Math.round(meters)} ม.`; }
function formatDuration(sec: number) {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} วินาที`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} นาที`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}
function instruction(step?: RouteStep) {
  const modifier = step?.maneuver?.modifier || "";
  const turn = modifier.includes("left") ? "เลี้ยวซ้าย" : modifier.includes("right") ? "เลี้ยวขวา" : modifier.includes("uturn") ? "กลับรถ" : modifier.includes("straight") ? "ตรงไป" : "ไปต่อ";
  return step?.name ? `${turn}เข้าสู่ ${step.name}` : turn;
}

async function geocode(query: string): Promise<{ point: LatLng; label: string }> {
  const url = new URL(GEOCODER);
  url.searchParams.set("SingleLine", query); url.searchParams.set("f", "json"); url.searchParams.set("maxLocations", "1");
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("ค้นหาสถานที่ไม่สำเร็จ");
  const data = await res.json(); const item = data?.candidates?.[0];
  if (!item?.location) throw new Error("ไม่พบสถานที่ที่ต้องการ");
  return { point: { lat: Number(item.location.y), lng: Number(item.location.x) }, label: String(item.address || query) };
}

async function route(from: LatLng, to: LatLng): Promise<RoutePlan> {
  const u = new URL(`${ROUTER}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}`);
  u.searchParams.set("overview", "full"); u.searchParams.set("geometries", "geojson"); u.searchParams.set("steps", "true"); u.searchParams.set("alternatives", "false");
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("คำนวณเส้นทางไม่สำเร็จ");
  const data = await res.json(); const r = data?.routes?.[0];
  if (!r) throw new Error("ไม่พบเส้นทางเดินไปยังสถานที่นี้");
  return { geometry: (r.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]), distance: Number(r.distance || 0), duration: Number(r.duration || 0), steps: (r.legs?.[0]?.steps || []) as RouteStep[], destination: to, label: "" };
}

function FollowCamera({ point }: { point: LatLng }) {
  const map = useMap();
  useEffect(() => { map.panTo([point.lat, point.lng], { animate: true, duration: 0.35 }); }, [map, point.lat, point.lng]);
  return null;
}

export function NavigationOverlay() {
  const [request, setRequest] = useState<NavRequest | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [progressM, setProgressM] = useState(0);
  const [lastMilestone, setLastMilestone] = useState(0);
  const [nextStepIndex, setNextStepIndex] = useState(0);
  const [announcedStep, setAnnouncedStep] = useState(-1);
  const [arrived, setArrived] = useState(false);
  const watchRef = useRef<number | null>(null);
  const previousPositionRef = useRef<LatLng | null>(null);
  const previousTimestampRef = useRef<number | null>(null);
  const lastRerouteRef = useRef(0);
  const requestIdRef = useRef(0);
  const speakRef = useRef<((text: string) => void) | null>(null);
  const milestoneKmRef = useRef(1);

  const say = (text: string) => speakRef.current?.(text);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<NavRequest>).detail;
      if (!detail?.destination) return;
      requestIdRef.current += 1;
      setRequest(detail); setActive(true); setPlan(null); setError(null); setLoading(false); setRerouting(false);
      milestoneKmRef.current = Math.max(0.25, Number(detail.milestoneKm) || 1);
      setLastMilestone(0); setProgressM(0); setNextStepIndex(0); setAnnouncedStep(-1); setArrived(false);
      previousPositionRef.current = null; previousTimestampRef.current = null;
    };
    const onStop = () => {
      requestIdRef.current += 1; setActive(false); setRequest(null); setPlan(null); setError(null); setLoading(false); setRerouting(false); setProgressM(0); setLastMilestone(0); setArrived(false);
      previousPositionRef.current = null; previousTimestampRef.current = null;
      if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
    window.addEventListener("wk:navigate-to", onRequest); window.addEventListener("wk:navigate-stop", onStop);
    return () => { window.removeEventListener("wk:navigate-to", onRequest); window.removeEventListener("wk:navigate-stop", onStop); };
  }, []);

  useEffect(() => {
    if (!active || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const point = { lat: p.coords.latitude, lng: p.coords.longitude };
        const acc = Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null;
        if (acc != null && acc > MAX_ACCURACY_M) return;
        const previous = previousPositionRef.current, previousTime = previousTimestampRef.current;
        if (previous && previousTime) {
          const dt = Math.max(0.5, (p.timestamp - previousTime) / 1000);
          const speed = distanceM(previous, point) / dt;
          if (speed > MAX_SPEED_MPS) return;
          setProgressM((v) => v + distanceM(previous, point));
        }
        previousPositionRef.current = point; previousTimestampRef.current = p.timestamp; setPosition(point); setAccuracy(acc);
      },
      (e) => setError(e.code === e.PERMISSION_DENIED ? "กรุณาอนุญาต GPS เพื่อใช้นำทาง" : "ไม่สามารถอ่านตำแหน่ง GPS ได้"),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    watchRef.current = id;
    return () => { navigator.geolocation.clearWatch(id); if (watchRef.current === id) watchRef.current = null; };
  }, [active]);

  useEffect(() => {
    if (!active || !position || !request || plan) return;
    const id = ++requestIdRef.current;
    setLoading(true); setError(null);
    (async () => {
      try {
        const found = await geocode(request.destination); const planned = await route(position, found.point);
        if (id !== requestIdRef.current) return;
        planned.label = found.label; setPlan(planned); setLoading(false); setNextStepIndex(0); setAnnouncedStep(-1);
        say(`ตั้งเส้นทางไป ${found.label} ระยะทาง ${formatKm(planned.distance)} ใช้เวลาประมาณ ${formatDuration(planned.duration)}`);
      } catch (e) { if (id === requestIdRef.current) { setLoading(false); setError(e instanceof Error ? e.message : "สร้างเส้นทางไม่สำเร็จ"); } }
    })();
  }, [active, position, request, plan]);

  const remaining = useMemo(() => (plan && position ? remainingRouteM(plan.geometry, position) : null), [plan, position]);
  const offRoute = useMemo(() => (plan && position ? closestRoutePoint(plan.geometry, position).distance : 0), [plan, position]);

  useEffect(() => {
    if (!active || !plan || !position || arrived || rerouting || offRoute <= REROUTE_OFF_ROUTE_M) return;
    const now = Date.now();
    if (now - lastRerouteRef.current < REROUTE_COOLDOWN_MS) return;
    lastRerouteRef.current = now;
    const id = ++requestIdRef.current;
    setRerouting(true); setError(null);
    (async () => {
      try {
        const planned = await route(position, plan.destination);
        if (id !== requestIdRef.current) return;
        planned.label = plan.label; setPlan(planned); setNextStepIndex(0); setAnnouncedStep(-1); setRerouting(false); say(`ออกนอกเส้นทาง ปรับเส้นทางใหม่แล้วครับ เหลือ ${formatKm(planned.distance)}`);
      } catch (e) { if (id === requestIdRef.current) { setRerouting(false); setError(e instanceof Error ? e.message : "ปรับเส้นทางใหม่ไม่สำเร็จ"); } }
    })();
  }, [active, plan, position, offRoute, arrived, rerouting]);

  useEffect(() => {
    if (!active || !plan || remaining == null || arrived) return;
    if (remaining <= ARRIVAL_M) { setArrived(true); say(`ถึง ${plan.label} แล้วครับ`); return; }
    const interval = milestoneKmRef.current * 1000; const milestone = Math.floor(progressM / interval);
    if (milestone > lastMilestone && milestone > 0) { setLastMilestone(milestone); say(`ครบ ${Math.round(milestone * milestoneKmRef.current * 10) / 10} กิโลเมตรแล้วครับ เหลืออีก ${formatKm(remaining)}`); }
  }, [active, plan, remaining, progressM, lastMilestone, arrived]);

  useEffect(() => {
    if (!active || !plan || !position || !request?.announceTurns || !plan.steps.length || arrived) return;
    let nearest = nextStepIndex, best = Number.POSITIVE_INFINITY;
    for (let i = nextStepIndex; i < plan.steps.length; i += 1) {
      const coords = plan.steps[i]?.geometry?.coordinates; if (!coords?.length) continue;
      const c = coords[0]; const d = distanceM(position, { lat: c[1], lng: c[0] });
      if (d < best) { best = d; nearest = i; }
      if (d > best && i > nextStepIndex + 2) break;
    }
    if (nearest > nextStepIndex) setNextStepIndex(nearest);
    if (nearest === nextStepIndex && nearest !== announcedStep && best <= TURN_ANNOUNCE_M) { setAnnouncedStep(nearest); say(`${instruction(plan.steps[nearest])} ในอีก ${formatKm(best)}`); }
  }, [active, plan, position, nextStepIndex, announcedStep, request?.announceTurns, arrived]);

  useEffect(() => {
    const speak = (text: string) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "th-TH"; u.rate = 0.95;
      const voices = window.speechSynthesis.getVoices(); const th = voices.find((v) => /^th[-_]/i.test(v.lang)) || voices.find((v) => v.lang.toLowerCase().startsWith("th"));
      if (th) u.voice = th; window.speechSynthesis.speak(u);
    };
    speakRef.current = speak; return () => { speakRef.current = null; if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  if (!active) return null;
  const center = position || DEFAULT_CENTER;
  const currentInstruction = plan?.steps[nextStepIndex] ? instruction(plan.steps[nextStepIndex]) : "กำลังเตรียมเส้นทาง";
  const eta = plan && remaining != null && plan.distance > 0 ? plan.duration * (remaining / plan.distance) : 0;

  return (
    <div className="mt-4 space-y-3">
      <div className="glass-strong overflow-hidden rounded-3xl shadow-soft">
        <div className="relative h-72 w-full overflow-hidden bg-black/30">
          <MapContainer center={[center.lat, center.lng]} zoom={16} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {position && <Marker position={[position.lat, position.lng]} icon={currentIcon} />}
            {plan && <Marker position={[plan.destination.lat, plan.destination.lng]} icon={destinationIcon} />}
            {plan?.geometry.length ? <Polyline positions={plan.geometry} pathOptions={{ color: "#22d3ee", weight: 6, opacity: 0.9 }} /> : null}
            {position && <FollowCamera point={position} />}
          </MapContainer>
          <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-2xl bg-black/70 px-3 py-2 text-xs text-white backdrop-blur"><LocateFixed className="size-4" />{accuracy == null ? "กำลังหาตำแหน่ง" : `GPS ±${Math.round(accuracy)} ม.`}</div>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("wk:navigate-stop"))} className="absolute right-3 top-3 z-[500] grid size-10 place-items-center rounded-2xl bg-black/70 text-white backdrop-blur" aria-label="หยุดนำทาง"><X className="size-5" /></button>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-400"><Flag className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-display font-semibold">{plan?.label || request?.destination}</p><p className="mt-0.5 text-xs text-muted-foreground">{loading ? "กำลังค้นหาและคำนวณเส้นทาง…" : rerouting ? "กำลังปรับเส้นทางใหม่…" : error || (plan ? `${arrived ? "ถึงแล้ว" : `เหลือ ${formatKm(remaining ?? plan.distance)} · ประมาณ ${formatDuration(eta)}`}` : "กำลังรอสัญญาณ GPS…")}</p></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-muted-foreground">เดินแล้ว</p><p className="mt-1 font-semibold">{formatKm(progressM)}</p></div><div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-muted-foreground">เหลือ</p><p className="mt-1 font-semibold">{formatKm(remaining ?? 0)}</p></div><div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-muted-foreground">สถานะ</p><p className="mt-1 font-semibold">{offRoute > REROUTE_OFF_ROUTE_M ? "ปรับเส้นทาง" : arrived ? "ถึงแล้ว" : "ปกติ"}</p></div></div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-cyan-400/10 px-3 py-3 text-sm"><Navigation className="size-4 shrink-0 text-cyan-300" /><span className="min-w-0 flex-1 truncate">{currentInstruction}</span><button type="button" onClick={() => say(currentInstruction)} className="press grid size-8 place-items-center rounded-xl" aria-label="พูดคำแนะนำ"><Volume2 className="size-4" /></button></div>
          <div className="mt-3 flex gap-2"><button type="button" onClick={() => say(plan ? `เส้นทางไป ${plan.label} เหลือ ${formatKm(remaining ?? 0)} ${arrived ? "ถึงแล้วครับ" : currentInstruction}` : "กำลังเตรียมเส้นทางครับ")} className="press flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm"><Volume2 className="size-4" /> รายงานเส้นทาง</button><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("wk:navigate-stop"))} className="press flex items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300"><X className="size-4" /> หยุด</button></div>
        </div>
      </div>
    </div>
  );
}
