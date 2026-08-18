import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, LocateFixed, Navigation, Volume2, X } from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };
type Step = { distance?: number; name?: string; maneuver?: { modifier?: string }; geometry?: { coordinates?: [number, number][] } };
type Plan = { geometry: [number, number][]; distance: number; duration: number; steps: Step[]; destination: Point; label: string };
type Request = { destination: string; milestoneKm?: number; announceTurns?: boolean };

const ROUTER = import.meta.env.VITE_ROUTING_API_URL || "https://router.project-osrm.org";
const GEOCODER = import.meta.env.VITE_GEOCODER_URL || "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const MAX_ACCURACY = 60;
const MAX_SPEED = 15;
const OFF_ROUTE = 75;
const REROUTE_COOLDOWN = 20_000;
const TURN_DISTANCE = 60;
const ARRIVAL = 30;

function dist(a: Point, b: Point) {
  const R = 6371000, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function project(p: Point, a: Point, b: Point) {
  const latScale = 111320;
  const lngScale = Math.max(1, 111320 * Math.cos(p.lat * Math.PI / 180));
  const ax = (a.lng - p.lng) * lngScale, ay = (a.lat - p.lat) * latScale;
  const bx = (b.lng - p.lng) * lngScale, by = (b.lat - p.lat) * latScale;
  const dx = bx - ax, dy = by - ay;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((-ax) * dx + (-ay) * dy) / (dx * dx + dy * dy)));
  return { point: { lat: p.lat + (ay + dy * t) / latScale, lng: p.lng + (ax + dx * t) / lngScale } };
}

function nearest(route: [number, number][], p: Point) {
  let best = { distance: Number.POSITIVE_INFINITY, index: 0, point: p };
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = { lat: route[i][0], lng: route[i][1] }, b = { lat: route[i + 1][0], lng: route[i + 1][1] };
    const q = project(p, a, b).point, d = dist(p, q);
    if (d < best.distance) best = { distance: d, index: i, point: q };
  }
  return best;
}

function remaining(route: [number, number][], p: Point) {
  if (route.length < 2) return 0;
  const n = nearest(route, p);
  let total = dist(n.point, { lat: route[n.index + 1][0], lng: route[n.index + 1][1] });
  for (let i = n.index + 1; i < route.length - 1; i += 1) total += dist({ lat: route[i][0], lng: route[i][1] }, { lat: route[i + 1][0], lng: route[i + 1][1] });
  return total;
}

function fmt(m: number) { return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} กม.` : `${Math.round(m)} ม.`; }
function time(sec: number) { const min = Math.max(1, Math.round(sec / 60)); return min < 60 ? `${min} นาที` : `${Math.floor(min / 60)} ชม. ${min % 60} นาที`; }
function turn(step?: Step) {
  const m = step?.maneuver?.modifier || "";
  const t = m.includes("left") ? "เลี้ยวซ้าย" : m.includes("right") ? "เลี้ยวขวา" : m.includes("uturn") ? "กลับรถ" : m.includes("straight") ? "ตรงไป" : "ไปต่อ";
  return step?.name ? `${t}เข้าสู่ ${step.name}` : t;
}

async function geocode(q: string): Promise<{ point: Point; label: string }> {
  const u = new URL(GEOCODER); u.searchParams.set("SingleLine", q); u.searchParams.set("f", "json"); u.searchParams.set("maxLocations", "1");
  const r = await fetch(u, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("ค้นหาสถานที่ไม่สำเร็จ");
  const d = await r.json(), c = d?.candidates?.[0];
  if (!c?.location) throw new Error("ไม่พบสถานที่ที่ต้องการ");
  return { point: { lat: Number(c.location.y), lng: Number(c.location.x) }, label: String(c.address || q) };
}

async function getRoute(from: Point, to: Point): Promise<Plan> {
  const u = new URL(`${ROUTER}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}`);
  u.searchParams.set("overview", "full"); u.searchParams.set("geometries", "geojson"); u.searchParams.set("steps", "true");
  const r = await fetch(u, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("คำนวณเส้นทางไม่สำเร็จ");
  const d = await r.json(), route = d?.routes?.[0];
  if (!route) throw new Error("ไม่พบเส้นทาง");
  return { geometry: (route.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]), distance: Number(route.distance || 0), duration: Number(route.duration || 0), steps: route.legs?.[0]?.steps || [], destination: to, label: "" };
}

function Follow({ point }: { point: Point }) {
  const map = useMap();
  useEffect(() => { map.panTo([point.lat, point.lng], { animate: true, duration: 0.25 }); }, [map, point.lat, point.lng]);
  return null;
}

export default function NavigationOverlayV2() {
  const [request, setRequest] = useState<Request | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lastMilestone, setLastMilestone] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [announcedStep, setAnnouncedStep] = useState(-1);
  const [arrived, setArrived] = useState(false);
  const watch = useRef<number | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const lastTime = useRef<number | null>(null);
  const lastReroute = useRef(0);
  const requestId = useRef(0);
  const milestone = useRef(1);
  const speak = useRef<(text: string) => void>(() => undefined);

  const say = (text: string) => speak.current(text);

  useEffect(() => {
    const onNav = (e: Event) => {
      const d = (e as CustomEvent<Request>).detail; if (!d?.destination) return;
      requestId.current += 1; setRequest(d); setActive(true); setPlan(null); setError(null); setLoading(false); setRerouting(false); setProgress(0); setLastMilestone(0); setStepIndex(0); setAnnouncedStep(-1); setArrived(false);
      milestone.current = Math.max(0.25, Number(d.milestoneKm) || 1);
      lastPoint.current = null; lastTime.current = null;
    };
    const onStop = () => {
      requestId.current += 1; setActive(false); setRequest(null); setPlan(null); setError(null); setLoading(false); setRerouting(false); setArrived(false);
      if (watch.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
    const onMilestone = (e: Event) => {
      const m = Number((e as CustomEvent<{ milestoneKm?: number }>).detail?.milestoneKm);
      if (Number.isFinite(m) && m > 0) { milestone.current = Math.max(0.25, m); setLastMilestone(0); }
    };
    window.addEventListener("wk:navigate-to", onNav); window.addEventListener("wk:navigate-stop", onStop); window.addEventListener("wk:navigation-milestone", onMilestone);
    return () => { window.removeEventListener("wk:navigate-to", onNav); window.removeEventListener("wk:navigate-stop", onStop); window.removeEventListener("wk:navigation-milestone", onMilestone); };
  }, []);

  useEffect(() => {
    if (!active || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((p) => {
      const point = { lat: p.coords.latitude, lng: p.coords.longitude }, acc = Number(p.coords.accuracy);
      if (Number.isFinite(acc) && acc > MAX_ACCURACY) return;
      const prev = lastPoint.current, prevTime = lastTime.current;
      if (prev && prevTime) {
        const dt = Math.max(0.5, (p.timestamp - prevTime) / 1000), d = dist(prev, point);
        if (d / dt > MAX_SPEED) return;
        setProgress((v) => v + d);
        if (d > 1 && d / dt > 0.8) {
          const y = Math.sin((point.lng - prev.lng) * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180);
          const x = Math.cos(prev.lat * Math.PI / 180) * Math.sin(point.lat * Math.PI / 180) - Math.sin(prev.lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) * Math.cos((point.lng - prev.lng) * Math.PI / 180);
          setHeading((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
        }
      }
      lastPoint.current = point; lastTime.current = p.timestamp; setPosition(point); setAccuracy(Number.isFinite(acc) ? acc : null);
    }, (e) => setError(e.code === e.PERMISSION_DENIED ? "กรุณาอนุญาต GPS เพื่อใช้นำทาง" : "ไม่สามารถอ่านตำแหน่ง GPS ได้"), { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
    watch.current = id;
    return () => { navigator.geolocation.clearWatch(id); if (watch.current === id) watch.current = null; };
  }, [active]);

  useEffect(() => {
    const speakThai = (text: string) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "th-TH"; u.rate = 0.95;
      const v = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("th")); if (v) u.voice = v; window.speechSynthesis.speak(u);
    };
    speak.current = speakThai; return () => { speak.current = () => undefined; };
  }, []);

  useEffect(() => {
    if (!active || !request || !position || plan) return;
    const id = ++requestId.current; setLoading(true); setError(null);
    (async () => {
      try {
        const found = await geocode(request.destination), next = await getRoute(position, found.point); if (id !== requestId.current) return;
        next.label = found.label; setPlan(next); setLoading(false); say(`ตั้งเส้นทางไป ${found.label} ระยะทาง ${fmt(next.distance)} ใช้เวลาประมาณ ${time(next.duration)}`);
      } catch (e) { if (id === requestId.current) { setLoading(false); setError(e instanceof Error ? e.message : "สร้างเส้นทางไม่สำเร็จ"); } }
    })();
  }, [active, request, position, plan]);

  const remainingM = useMemo(() => plan && position ? remaining(plan.geometry, position) : null, [plan, position]);
  const offRouteM = useMemo(() => plan && position ? nearest(plan.geometry, position).distance : 0, [plan, position]);

  useEffect(() => {
    if (!active || !plan || !position || arrived || rerouting || offRouteM <= OFF_ROUTE) return;
    const now = Date.now(); if (now - lastReroute.current < REROUTE_COOLDOWN) return;
    lastReroute.current = now; const id = ++requestId.current; setRerouting(true);
    (async () => {
      try {
        const next = await getRoute(position, plan.destination); if (id !== requestId.current) return;
        next.label = plan.label; setPlan(next); setStepIndex(0); setAnnouncedStep(-1); setRerouting(false); say(`ออกนอกเส้นทาง ปรับเส้นทางใหม่แล้วครับ เหลือ ${fmt(next.distance)}`);
      } catch (e) { if (id === requestId.current) { setRerouting(false); setError(e instanceof Error ? e.message : "ปรับเส้นทางใหม่ไม่สำเร็จ"); } }
    })();
  }, [active, plan, position, offRouteM, arrived, rerouting]);

  useEffect(() => {
    if (!active || !plan || remainingM == null || arrived) return;
    if (remainingM <= ARRIVAL) { setArrived(true); say(`ถึง ${plan.label} แล้วครับ`); return; }
    const every = milestone.current * 1000, crossed = Math.floor(progress / every);
    if (crossed > lastMilestone && crossed > 0) { setLastMilestone(crossed); say(`ครบ ${Math.round(crossed * milestone.current * 10) / 10} กิโลเมตรแล้วครับ เหลืออีก ${fmt(remainingM)}`); }
  }, [active, plan, remainingM, progress, lastMilestone, arrived]);

  useEffect(() => {
    if (!active || !plan || !position || !request?.announceTurns || arrived || !plan.steps.length) return;
    let best = Number.POSITIVE_INFINITY, next = stepIndex;
    for (let i = stepIndex; i < plan.steps.length; i += 1) {
      const c = plan.steps[i]?.geometry?.coordinates?.[0]; if (!c) continue;
      const d = dist(position, { lat: c[1], lng: c[0] });
      if (d < best) { best = d; next = i; }
    }
    if (next > stepIndex) setStepIndex(next);
    if (next === stepIndex && next !== announcedStep && best <= TURN_DISTANCE) { setAnnouncedStep(next); say(`${turn(plan.steps[next])} ในอีก ${fmt(best)}`); }
  }, [active, plan, position, stepIndex, announcedStep, request?.announceTurns, arrived]);

  const marker = useMemo(() => L.divIcon({ className: "!bg-transparent !border-0", iconSize: [52, 52], iconAnchor: [26, 26], html: `<div style="transform:rotate(${heading}deg);width:52px;height:52px;border-radius:50%;background:rgba(34,211,238,.15);display:grid;place-items:center"><div style="width:34px;height:34px;border-radius:50%;background:#14b8a6;color:white;display:grid;place-items:center;box-shadow:0 3px 14px rgba(0,0,0,.35)"><span style="font-size:22px">▲</span></div></div>` }), [heading]);
  if (!active) return null;
  const center = position || { lat: 13.7563, lng: 100.5018 };
  const currentStep = plan?.steps[stepIndex];
  const eta = plan && remainingM != null && plan.distance > 0 ? plan.duration * (remainingM / plan.distance) : 0;
  return (
    <div className="mt-4 space-y-3">
      <div className="glass-strong overflow-hidden rounded-3xl shadow-soft">
        <div className="relative h-72 w-full overflow-hidden">
          <MapContainer center={[center.lat, center.lng]} zoom={16} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {plan?.geometry?.length ? <><Polyline positions={plan.geometry} pathOptions={{ color: "#03121b", weight: 10, opacity: 0.9 }} /><Polyline positions={plan.geometry} pathOptions={{ color: "#22d3ee", weight: 6, opacity: 0.95 }} /></> : null}
            {position && <Marker position={[position.lat, position.lng]} icon={marker} />}
            {plan && <Marker position={[plan.destination.lat, plan.destination.lng]} icon={L.divIcon({ className: "!bg-transparent !border-0", iconSize: [40, 50], iconAnchor: [20, 48], html: `<div style="width:40px;height:50px;display:grid;place-items:center"><div style="width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#fb7185;box-shadow:0 4px 14px rgba(0,0,0,.35)"><span style="display:block;transform:rotate(45deg);color:#fff;text-align:center;font-size:16px;margin-top:6px">●</span></div></div>` })} />}
            {position && <Follow point={position} />}
          </MapContainer>
          <div className="absolute left-3 top-3 z-[500] rounded-2xl bg-black/70 px-3 py-2 text-xs text-white backdrop-blur"><LocateFixed className="mr-1 inline size-4" />GPS {accuracy == null ? "…" : `±${Math.round(accuracy)} ม.`}</div>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("wk:navigate-stop"))} className="absolute right-3 top-3 z-[500] grid size-10 place-items-center rounded-2xl bg-black/70 text-white backdrop-blur" aria-label="หยุดนำทาง"><X className="size-5" /></button>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-400"><Flag className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{plan?.label || request?.destination}</p><p className="mt-0.5 text-xs text-muted-foreground">{loading ? "กำลังคำนวณเส้นทาง…" : rerouting ? "กำลังปรับเส้นทางใหม่…" : error || (plan ? `${arrived ? "ถึงแล้ว" : `เหลือ ${fmt(remainingM ?? plan.distance)} · ประมาณ ${time(eta)}`}` : "กำลังรอสัญญาณ GPS…")}</p></div></div>
          {currentStep && <div className="mt-3 flex items-center gap-2 rounded-2xl bg-cyan-400/10 px-3 py-3 text-sm"><Navigation className="size-4 shrink-0 text-cyan-300" /><span className="min-w-0 flex-1 truncate">{turn(currentStep)}</span><button type="button" onClick={() => say(turn(currentStep))} className="grid size-8 place-items-center rounded-xl" aria-label="พูดคำแนะนำ"><Volume2 className="size-4" /></button></div>}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-2xl bg-white/5 p-2"><p className="font-semibold">{fmt(progress)}</p><p className="text-muted-foreground">เดินแล้ว</p></div><div className="rounded-2xl bg-white/5 p-2"><p className="font-semibold">{fmt(remainingM ?? 0)}</p><p className="text-muted-foreground">เหลือ</p></div><div className="rounded-2xl bg-white/5 p-2"><p className="font-semibold">{milestone.current} กม.</p><p className="text-muted-foreground">แจ้งเตือน</p></div></div>
          <button type="button" onClick={() => say(plan ? `เส้นทางไป ${plan.label} เหลือ ${fmt(remainingM ?? 0)}` : "กำลังเตรียมเส้นทางครับ")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm"><Volume2 className="size-4" /> รายงานเส้นทาง</button>
        </div>
      </div>
    </div>
  );
}
