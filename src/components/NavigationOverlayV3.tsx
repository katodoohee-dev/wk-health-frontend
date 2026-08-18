import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, LocateFixed, Navigation, Volume2, X } from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { speakThai, stopVoiceOutput } from "@/lib/voice-output";

type Point = { lat: number; lng: number };
type Step = { name?: string; maneuver?: { modifier?: string }; geometry?: { coordinates?: [number, number][] } };
type Plan = { geometry: [number, number][]; distance: number; duration: number; steps: Step[]; destination: Point; label: string };
type Request = { destination: string; milestoneKm?: number; announceTurns?: boolean };

const ROUTER = import.meta.env.VITE_ROUTING_API_URL || "https://router.project-osrm.org";
const GEOCODER = import.meta.env.VITE_GEOCODER_URL || "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const MAX_ACCURACY = 100;
const MAX_SPEED = 25;
const OFF_ROUTE = 80;
const ARRIVAL = 35;
const TURN_DISTANCE = 70;
const REROUTE_COOLDOWN = 20000;

function distance(a: Point, b: Point) {
  const R = 6371000, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function fmt(m: number | null | undefined) {
  if (!Number.isFinite(m)) return "ไม่ทราบ";
  const value = Number(m);
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} กม.` : `${Math.round(value)} ม.`;
}

function eta(sec: number | null | undefined) {
  if (!Number.isFinite(sec)) return "ไม่ทราบ";
  const min = Math.max(1, Math.round(Number(sec) / 60));
  return min < 60 ? `${min} นาที` : `${Math.floor(min / 60)} ชม. ${min % 60} นาที`;
}

function turn(step?: Step) {
  const m = step?.maneuver?.modifier || "";
  const t = m.includes("left") ? "เลี้ยวซ้าย" : m.includes("right") ? "เลี้ยวขวา" : m.includes("uturn") ? "กลับรถ" : "ตรงไป";
  return step?.name ? `${t}เข้าสู่ ${step.name}` : t;
}

function nearest(route: [number, number][], p: Point) {
  let best = { distance: Infinity, index: 0 };
  const latScale = 111320;
  const lngScale = Math.max(1, 111320 * Math.cos(p.lat * Math.PI / 180));
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i], b = route[i + 1];
    const ax = (a[1] - p.lng) * lngScale, ay = (a[0] - p.lat) * latScale;
    const bx = (b[1] - p.lng) * lngScale, by = (b[0] - p.lat) * latScale;
    const dx = bx - ax, dy = by - ay;
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((-ax) * dx + (-ay) * dy) / (dx * dx + dy * dy)));
    const q = { lat: p.lat + (ay + dy * t) / latScale, lng: p.lng + (ax + dx * t) / lngScale };
    const d = distance(p, q);
    if (d < best.distance) best = { distance: d, index: i };
  }
  return best;
}

function remaining(route: [number, number][], p: Point) {
  if (route.length < 2) return 0;
  const n = nearest(route, p);
  let total = distance(p, { lat: route[n.index + 1][0], lng: route[n.index + 1][1] });
  for (let i = n.index + 1; i < route.length - 1; i += 1) total += distance({ lat: route[i][0], lng: route[i][1] }, { lat: route[i + 1][0], lng: route[i + 1][1] });
  return total;
}

async function geocode(q: string) {
  const u = new URL(GEOCODER);
  u.searchParams.set("SingleLine", q); u.searchParams.set("f", "json"); u.searchParams.set("maxLocations", "1");
  const r = await fetch(u, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("ค้นหาสถานที่ไม่สำเร็จ");
  const d = await r.json(); const c = d?.candidates?.[0];
  if (!c?.location) throw new Error("ไม่พบสถานที่ที่ต้องการ");
  return { point: { lat: Number(c.location.y), lng: Number(c.location.x) } as Point, label: String(c.address || q) };
}

async function route(from: Point, to: Point): Promise<Plan> {
  const u = new URL(`${ROUTER}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}`);
  u.searchParams.set("overview", "full"); u.searchParams.set("geometries", "geojson"); u.searchParams.set("steps", "true");
  const r = await fetch(u, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("คำนวณเส้นทางไม่สำเร็จ");
  const d = await r.json(); const x = d?.routes?.[0];
  if (!x) throw new Error("ไม่พบเส้นทาง");
  return { geometry: (x.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]), distance: Number(x.distance || 0), duration: Number(x.duration || 0), steps: x.legs?.[0]?.steps || [], destination: to, label: "" };
}

function Follow({ point }: { point: Point }) { const map = useMap(); useEffect(() => { map.panTo([point.lat, point.lng], { animate: true, duration: 0.2 }); }, [map, point.lat, point.lng]); return null; }
function Fit({ position, target, geometry }: { position: Point | null; target: Point | null; geometry?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (geometry?.length) map.fitBounds(geometry as [number, number][], { padding: [28, 28], maxZoom: 17 });
    else if (position && target) map.fitBounds([[position.lat, position.lng], [target.lat, target.lng]], { padding: [36, 36], maxZoom: 16 });
  }, [map, position, target, geometry]);
  return null;
}

const userIcon = (heading: number) => L.divIcon({ className: "!bg-transparent !border-0", iconSize: [52, 52], iconAnchor: [26, 26], html: `<div style="transform:rotate(${heading}deg);width:52px;height:52px;border-radius:50%;background:rgba(34,211,238,.16);display:grid;place-items:center"><div style="width:34px;height:34px;border-radius:50%;background:#14b8a6;color:#fff;display:grid;place-items:center;box-shadow:0 3px 14px rgba(0,0,0,.35)"><span style="font-size:22px">▲</span></div></div>` });
const targetIcon = L.divIcon({ className: "!bg-transparent !border-0", iconSize: [44, 54], iconAnchor: [22, 52], html: `<div style="width:44px;height:54px;display:grid;place-items:center"><div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#fb7185;box-shadow:0 4px 14px rgba(0,0,0,.35);display:grid;place-items:center"><span style="transform:rotate(45deg);color:#fff;font-size:18px">●</span></div></div>` });

export default function NavigationOverlayV3() {
  const [request, setRequest] = useState<Request | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [target, setTarget] = useState<Point | null>(null);
  const [targetLabel, setTargetLabel] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("กำลังเตรียมนำทาง…");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [milestone, setMilestone] = useState(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [announcedStep, setAnnouncedStep] = useState(-1);
  const [arrived, setArrived] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const previousRef = useRef<{ point: Point; time: number } | null>(null);
  const lastReroute = useRef(0);
  const requestId = useRef(0);

  const say = (text: string) => speakThai(text, { source: "navigation", priority: 100, interrupt: true });

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const d = (event as CustomEvent<Request>).detail;
      if (!d?.destination?.trim()) return;
      requestId.current += 1; previousRef.current = null;
      setRequest({ ...d, destination: d.destination.trim() }); setTarget(null); setTargetLabel(""); setPlan(null); setPosition(null); setAccuracy(null);
      setActive(true); setStatus("กำลังค้นหาจุดหมาย…"); setError(null); setProgress(0); setStepIndex(0); setAnnouncedStep(-1); setArrived(false); setRerouting(false);
      setMilestone(Math.max(0.25, Number(d.milestoneKm) || 1)); stopVoiceOutput();
    };
    const onStop = () => { requestId.current += 1; setActive(false); setRequest(null); setTarget(null); setTargetLabel(""); setPlan(null); setError(null); setStatus("หยุดนำทาง"); previousRef.current = null; stopVoiceOutput(); };
    const onMilestone = (event: Event) => { const m = Number((event as CustomEvent<{ milestoneKm?: number }>).detail?.milestoneKm); if (Number.isFinite(m) && m > 0) setMilestone(Math.max(0.25, m)); };
    window.addEventListener("wk:navigate-to", onNavigate); window.addEventListener("wk:navigate-stop", onStop); window.addEventListener("wk:navigation-milestone", onMilestone);
    return () => { window.removeEventListener("wk:navigate-to", onNavigate); window.removeEventListener("wk:navigate-stop", onStop); window.removeEventListener("wk:navigation-milestone", onMilestone); };
  }, []);

  useEffect(() => {
    if (!active || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((p) => {
      const point = { lat: p.coords.latitude, lng: p.coords.longitude }; const acc = Number(p.coords.accuracy);
      if (Number.isFinite(acc) && acc > MAX_ACCURACY) { setAccuracy(acc); setStatus("GPS อ่อน กำลังรอสัญญาณที่แม่นยำขึ้น…"); return; }
      const prev = previousRef.current;
      if (prev) {
        const dt = Math.max(0.5, (p.timestamp - prev.time) / 1000); const d = distance(prev.point, point); const speed = d / dt;
        if (speed > MAX_SPEED) return;
        if (d > 1) { setProgress((v) => v + d); if (speed > 0.8) { const y = Math.sin((point.lng - prev.point.lng) * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180); const x = Math.cos(prev.point.lat * Math.PI / 180) * Math.sin(point.lat * Math.PI / 180) - Math.sin(prev.point.lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) * Math.cos((point.lng - prev.point.lng) * Math.PI / 180); setHeading((Math.atan2(y, x) * 180 / Math.PI + 360) % 360); } }
      }
      previousRef.current = { point, time: p.timestamp }; setPosition(point); setAccuracy(Number.isFinite(acc) ? acc : null); setStatus(target ? "กำลังติดตามตำแหน่ง GPS…" : "กำลังระบุตำแหน่ง GPS…");
    }, (e) => setError(e.code === e.PERMISSION_DENIED ? "กรุณาอนุญาตตำแหน่ง GPS" : "ไม่สามารถอ่านตำแหน่ง GPS ได้"), { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [active, target]);

  useEffect(() => {
    if (!active || !request) return;
    const id = ++requestId.current;
    (async () => {
      try {
        const found = await geocode(request.destination); if (id !== requestId.current) return;
        setTarget(found.point); setTargetLabel(found.label); setStatus("พบจุดหมายแล้ว กำลังหาตำแหน่งปัจจุบัน…");
      } catch (e) { if (id === requestId.current) { setError(e instanceof Error ? e.message : "ค้นหาจุดหมายไม่สำเร็จ"); setStatus("ไม่พบจุดหมาย"); } }
    })();
  }, [active, request]);

  useEffect(() => {
    if (!active || !position || !target || plan) return;
    const id = ++requestId.current;
    (async () => {
      try {
        setStatus("พบตำแหน่งแล้ว กำลังคำนวณเส้นทาง…");
        const next = await route(position, target); if (id !== requestId.current) return;
        next.label = targetLabel || request?.destination || "จุดหมาย"; setPlan(next); setStatus("กำลังนำทาง");
        say(`ปักหมุด ${next.label} แล้ว ระยะทางตามถนน ${fmt(next.distance)} ใช้เวลาประมาณ ${eta(next.duration)}`);
      } catch {
        if (id === requestId.current) { setStatus("ปักหมุดแล้ว แต่ยังคำนวณเส้นทางตามถนนไม่ได้"); say(`ปักหมุด ${targetLabel || request?.destination || "จุดหมาย"} แล้ว ระยะเส้นตรง ${fmt(distance(position, target))}`); }
      }
    })();
  }, [active, position, target, plan, targetLabel, request]);

  const remainingM = useMemo(() => plan && position ? remaining(plan.geometry, position) : position && target ? distance(position, target) : null, [plan, position, target]);
  const offRouteM = useMemo(() => plan && position ? nearest(plan.geometry, position).distance : 0, [plan, position]);

  useEffect(() => {
    if (!active || !plan || !position || arrived || rerouting || offRouteM <= OFF_ROUTE) return;
    if (Date.now() - lastReroute.current < REROUTE_COOLDOWN) return;
    lastReroute.current = Date.now(); const id = ++requestId.current; setRerouting(true);
    route(position, plan.destination).then((next) => { if (id !== requestId.current) return; next.label = plan.label; setPlan(next); setStepIndex(0); setAnnouncedStep(-1); setRerouting(false); say(`ออกนอกเส้นทาง ปรับเส้นทางใหม่แล้วครับ เหลือ ${fmt(next.distance)}`); }).catch(() => { if (id === requestId.current) setRerouting(false); });
  }, [active, plan, position, offRouteM, arrived, rerouting]);

  useEffect(() => {
    if (!active || !target || remainingM == null || arrived) return;
    if (remainingM <= ARRIVAL) { setArrived(true); say(`ถึง ${targetLabel || request?.destination || "จุดหมาย"} แล้วครับ`); return; }
    const every = milestone * 1000; const crossed = Math.floor(progress / every); if (crossed > 0 && Math.abs(crossed * every - progress) < 80) say(`ครบ ${Math.round(crossed * milestone * 10) / 10} กิโลเมตรแล้วครับ เหลืออีก ${fmt(remainingM)}`);
  }, [active, target, remainingM, progress, milestone, arrived, targetLabel, request]);

  useEffect(() => {
    if (!active || !plan || !position || !request?.announceTurns || arrived || !plan.steps.length) return;
    let best = Infinity, next = stepIndex;
    for (let i = stepIndex; i < plan.steps.length; i += 1) { const c = plan.steps[i]?.geometry?.coordinates?.[0]; if (!c) continue; const d = distance(position, { lat: c[1], lng: c[0] }); if (d < best) { best = d; next = i; } }
    if (next > stepIndex) setStepIndex(next);
    if (next === stepIndex && next !== announcedStep && best <= TURN_DISTANCE) { setAnnouncedStep(next); say(`${turn(plan.steps[next])} ในอีก ${fmt(best)}`); }
  }, [active, plan, position, request?.announceTurns, stepIndex, announcedStep, arrived]);

  if (!active) return null;
  const center = position || target || { lat: 13.7563, lng: 100.5018 };
  const currentStep = plan?.steps[stepIndex];
  const etaRemaining = plan && remainingM != null && plan.distance > 0 ? plan.duration * remainingM / plan.distance : null;
  return (
    <div className="mt-4 space-y-3">
      <div className="glass-strong overflow-hidden rounded-3xl shadow-soft">
        <div className="relative h-80 w-full overflow-hidden">
          <MapContainer center={[center.lat, center.lng]} zoom={15} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Fit position={position} target={target} geometry={plan?.geometry} />
            {plan?.geometry?.length ? <Polyline positions={plan.geometry} pathOptions={{ color: "#071923", weight: 10, opacity: 0.95 }} /> : null}
            {plan?.geometry?.length ? <Polyline positions={plan.geometry} pathOptions={{ color: "#22d3ee", weight: 6, opacity: 1 }} /> : null}
            {target ? <Marker position={[target.lat, target.lng]} icon={targetIcon} /> : null}
            {position ? <Marker position={[position.lat, position.lng]} icon={userIcon(heading)} /> : null}
            {position ? <Follow point={position} /> : null}
          </MapContainer>
          <div className="absolute left-3 top-3 z-[500] rounded-2xl bg-black/75 px-3 py-2 text-xs text-white backdrop-blur"><LocateFixed className="mr-1 inline size-4" />{position ? `ตำแหน่ง GPS ±${Math.round(accuracy || 0)} ม.` : "กำลังหาตำแหน่ง GPS…"}</div>
          <div className="absolute left-3 bottom-3 z-[500] rounded-2xl bg-black/80 px-3 py-2 text-xs text-white backdrop-blur">เป้าหมาย: {targetLabel || request?.destination || "กำลังค้นหา…"}</div>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("wk:navigate-stop"))} className="absolute right-3 top-3 z-[500] grid size-10 place-items-center rounded-2xl bg-black/75 text-white backdrop-blur" aria-label="หยุดนำทาง"><X className="size-5" /></button>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-400"><Flag className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{targetLabel || request?.destination}</p><p className="mt-0.5 text-xs text-muted-foreground">{error || status}</p></div></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-2xl bg-white/5 p-3"><p className="font-semibold">{fmt(remainingM)}</p><p className="text-muted-foreground">ระยะถึงเป้าหมาย</p></div><div className="rounded-2xl bg-white/5 p-3"><p className="font-semibold">{fmt(progress)}</p><p className="text-muted-foreground">เคลื่อนที่แล้ว</p></div><div className="rounded-2xl bg-white/5 p-3"><p className="font-semibold">{etaRemaining == null ? "—" : eta(etaRemaining)}</p><p className="text-muted-foreground">เวลาโดยประมาณ</p></div></div>
          {!plan && position && target ? <div className="mt-3 rounded-2xl bg-cyan-400/10 px-3 py-3 text-sm">ยังไม่มีเส้นทางถนน ใช้ระยะเส้นตรงถึงเป้าหมาย {fmt(remainingM)} ชั่วคราว</div> : null}
          {currentStep ? <div className="mt-3 flex items-center gap-2 rounded-2xl bg-cyan-400/10 px-3 py-3 text-sm"><Navigation className="size-4 shrink-0 text-cyan-300" /><span className="min-w-0 flex-1 truncate">{turn(currentStep)}</span><button type="button" onClick={() => say(turn(currentStep))} className="grid size-8 place-items-center rounded-xl" aria-label="พูดคำแนะนำ"><Volume2 className="size-4" /></button></div> : null}
          <button type="button" onClick={() => say(target ? `จุดหมาย ${targetLabel || request?.destination} ระยะที่เหลือ ${fmt(remainingM)}` : "กำลังค้นหาจุดหมายครับ")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm"><Volume2 className="size-4" /> รายงานตำแหน่งและระยะทาง</button>
        </div>
      </div>
    </div>
  );
}
