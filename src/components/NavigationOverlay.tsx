import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, LocateFixed, MapPin, Navigation, Route as RouteIcon, Volume2, X } from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLng = { lat: number; lng: number };
type RouteStep = { distance: number; duration: number; name?: string; maneuver?: { type?: string; modifier?: string }; geometry?: { coordinates?: [number, number][] } };
type RoutePlan = { geometry: [number, number][]; distance: number; duration: number; steps: RouteStep[]; destination: LatLng; label: string };
type NavRequest = { destination: string; milestoneKm?: number | null; announceTurns?: boolean };

const ROUTER = import.meta.env.VITE_ROUTING_API_URL || "https://router.project-osrm.org";
const GEOCODER = import.meta.env.VITE_GEOCODER_URL || "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

const currentIcon = L.divIcon({
  className: "!bg-transparent !border-0",
  iconSize: [54, 54],
  iconAnchor: [27, 27],
  html: `<div style="width:54px;height:54px;border-radius:50%;background:rgba(45,212,191,.18);display:grid;place-items:center"><div style="width:36px;height:36px;border-radius:50%;background:#14b8a6;color:white;display:grid;place-items:center;box-shadow:0 3px 16px rgba(0,0,0,.35)"><span style="font-size:22px;line-height:1">▲</span></div></div>`,
});
const destinationIcon = L.divIcon({
  className: "!bg-transparent !border-0",
  iconSize: [44, 54],
  iconAnchor: [22, 50],
  html: `<div style="width:44px;height:54px;display:grid;place-items:center"><div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#fb7185;box-shadow:0 4px 16px rgba(0,0,0,.35);display:grid;place-items:center"><span style="transform:rotate(45deg);color:white;font-size:18px">●</span></div></div>`,
});

function distanceM(a: LatLng, b: LatLng) {
  const R = 6371000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function bearing(a: LatLng, b: LatLng) {
  const y = Math.sin(((b.lng - a.lng) * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) - Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lng - a.lng) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI + 360 % 360;
}

function formatKm(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} กม.` : `${Math.round(meters)} ม.`;
}
function formatDuration(sec: number) {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} วินาที`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} นาที`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}
function instruction(step?: RouteStep) {
  if (!step?.maneuver) return "เดินตามเส้นทาง";
  const modifier = step.maneuver.modifier || "";
  const turn = modifier.includes("left") ? "เลี้ยวซ้าย" : modifier.includes("right") ? "เลี้ยวขวา" : modifier.includes("uturn") ? "กลับรถ" : modifier.includes("straight") ? "ตรงไป" : "ไปต่อ";
  return step.name ? `${turn}เข้าสู่ ${step.name}` : turn;
}

async function geocode(query: string): Promise<{ point: LatLng; label: string }> {
  const url = new URL(GEOCODER);
  url.searchParams.set("SingleLine", query);
  url.searchParams.set("f", "json");
  url.searchParams.set("maxLocations", "1");
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("ค้นหาสถานที่ไม่สำเร็จ");
  const data = await res.json();
  const item = data?.candidates?.[0];
  if (!item?.location) throw new Error("ไม่พบสถานที่ที่ต้องการ");
  return { point: { lat: Number(item.location.y), lng: Number(item.location.x) }, label: String(item.address || query) };
}

async function route(from: LatLng, to: LatLng): Promise<RoutePlan> {
  const url = `${ROUTER}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}`;
  const u = new URL(url);
  u.searchParams.set("overview", "full");
  u.searchParams.set("geometries", "geojson");
  u.searchParams.set("steps", "true");
  u.searchParams.set("alternatives", "false");
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("คำนวณเส้นทางไม่สำเร็จ");
  const data = await res.json();
  const r = data?.routes?.[0];
  if (!r) throw new Error("ไม่พบเส้นทางเดินไปยังสถานที่นี้");
  return {
    geometry: (r.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]),
    distance: Number(r.distance || 0),
    duration: Number(r.duration || 0),
    steps: (r.legs?.[0]?.steps || []) as RouteStep[],
    destination: to,
    label: "",
  };
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
  const [error, setError] = useState<string | null>(null);
  const [lastAnnouncedKm, setLastAnnouncedKm] = useState(0);
  const [nextStepIndex, setNextStepIndex] = useState(0);
  const [active, setActive] = useState(false);
  const watchRef = useRef<number | null>(null);
  const speakRef = useRef<((text: string) => void) | null>(null);
  const milestoneKmRef = useRef(1);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<NavRequest>).detail;
      if (!detail?.destination) return;
      setRequest(detail);
      milestoneKmRef.current = Math.max(0.25, Number(detail.milestoneKm) || 1);
      setLastAnnouncedKm(0);
      setNextStepIndex(0);
      setError(null);
      setActive(true);
    };
    const onStop = () => {
      setActive(false);
      setRequest(null);
      setPlan(null);
      setError(null);
    };
    window.addEventListener("wk:navigate-to", onRequest);
    window.addEventListener("wk:navigate-stop", onStop);
    return () => {
      window.removeEventListener("wk:navigate-to", onRequest);
      window.removeEventListener("wk:navigate-stop", onStop);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      return;
    }
    if (!navigator.geolocation) { setError("อุปกรณ์นี้ไม่รองรับ GPS"); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => { setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }); setAccuracy(p.coords.accuracy ?? null); },
      (e) => setError(e.code === e.PERMISSION_DENIED ? "กรุณาอนุญาต GPS เพื่อใช้นำทาง" : "ไม่สามารถอ่านตำแหน่ง GPS ได้"),
      { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 },
    );
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; };
  }, [active]);

  useEffect(() => {
    if (!active || !position || !request || plan) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const found = await geocode(request.destination);
        const planned = await route(position, found.point);
        if (cancelled) return;
        planned.label = found.label;
        setPlan(planned);
        speakRef.current?.(`ตั้งเส้นทางไป ${found.label} ระยะทาง ${formatKm(planned.distance)} ใช้เวลาประมาณ ${formatDuration(planned.duration)}`);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "สร้างเส้นทางไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active, position, request, plan]);

  useEffect(() => {
    const onTts = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (text) speakRef.current?.(text);
    };
    window.addEventListener("wk:navigation-speak", onTts);
    return () => window.removeEventListener("wk:navigation-speak", onTts);
  }, []);

  useEffect(() => {
    const say = (text: string) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "th-TH";
      u.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const th = voices.find((v) => /^th[-_]/i.test(v.lang)) || voices.find((v) => v.lang.toLowerCase().startsWith("th"));
      if (th) u.voice = th;
      window.speechSynthesis.speak(u);
    };
    speakRef.current = say;
    return () => { speakRef.current = null; };
  }, []);

  const remaining = useMemo(() => plan && position ? distanceM(position, plan.destination) : null, [plan, position]);
  const progressKm = plan && remaining != null ? Math.max(0, plan.distance - remaining) / 1000 : 0;
  const nextStep = plan?.steps[nextStepIndex];
  const nextStepDistance = useMemo(() => {
    if (!plan || !position || !nextStep?.geometry?.coordinates?.length) return nextStep?.distance ?? 0;
    const c = nextStep.geometry.coordinates[0];
    return distanceM(position, { lat: c[1], lng: c[0] });
  }, [plan, position, nextStep]);

  useEffect(() => {
    if (!active || !plan || remaining == null) return;
    const interval = milestoneKmRef.current;
    const crossed = Math.floor(progressKm / interval);
    if (crossed > lastAnnouncedKm && crossed > 0) {
      setLastAnnouncedKm(crossed);
      speakRef.current?.(`ผ่านไป ${Math.round(crossed * interval * 10) / 10} กิโลเมตรแล้วครับ เหลืออีก ${formatKm(remaining)}`);
    }
    if (remaining < 30) speakRef.current?.(`ใกล้ถึง ${plan.label} แล้วครับ`);
  }, [active, plan, remaining, progressKm, lastAnnouncedKm]);

  useEffect(() => {
    if (!active || !plan || !request?.announceTurns || !position || !plan.steps.length) return;
    let nearest = nextStepIndex;
    let best = Number.POSITIVE_INFINITY;
    for (let i = nextStepIndex; i < plan.steps.length; i += 1) {
      const coords = plan.steps[i]?.geometry?.coordinates;
      if (!coords?.length) continue;
      const d = distanceM(position, { lat: coords[0][1], lng: coords[0][0] });
      if (d < best) { best = d; nearest = i; }
    }
    if (nearest > nextStepIndex) setNextStepIndex(nearest);
    if (nearest === nextStepIndex && best < 45) speakRef.current?.(`${instruction(plan.steps[nearest])} ในอีก ${formatKm(best)}`);
  }, [active, plan, position, nextStepIndex, request?.announceTurns]);

  if (!active) return null;

  return (
    <div className="mt-4 space-y-3">
      <div className="glass-strong rounded-3xl p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-400"><Flag className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-semibold">{plan?.label || request?.destination}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{loading ? "กำลังค้นหาและคำนวณเส้นทาง…" : error || (plan ? `เหลือ ${formatKm(remaining ?? 0)} · ประมาณ ${formatDuration(plan.duration * ((remaining ?? plan.distance) / Math.max(plan.distance, 1)))}` : "กำลังรอสัญญาณ GPS…")}</p>
          </div>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("wk:navigate-stop"))} className="press grid size-9 place-items-center rounded-xl" aria-label="หยุดนำทาง"><X className="size-4" /></button>
        </div>
        {plan && position && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-2xl bg-muted/60 p-2"><p className="font-semibold tabular-nums">{formatKm(plan.distance)}</p><p className="text-muted-foreground">เส้นทาง</p></div>
            <div className="rounded-2xl bg-muted/60 p-2"><p className="font-semibold tabular-nums">{formatKm(remaining ?? 0)}</p><p className="text-muted-foreground">เหลือ</p></div>
            <div className="rounded-2xl bg-muted/60 p-2"><p className="font-semibold tabular-nums">{formatKm(nextStepDistance)}</p><p className="text-muted-foreground">คำสั่งถัดไป</p></div>
          </div>
        )}
        {nextStep && <div className="mt-3 flex items-center gap-2 rounded-2xl bg-sky/10 px-3 py-2.5 text-sm"><Navigation className="size-4 shrink-0 text-sky" /><span>{instruction(nextStep)} · {formatKm(nextStepDistance)}</span></div>}
        {accuracy != null && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><LocateFixed className="size-3" /> GPS ±{Math.round(accuracy)} ม.</p>}
      </div>

      {position && plan && (
        <div className="overflow-hidden rounded-3xl" style={{ height: 380 }}>
          <MapContainer center={[position.lat, position.lng]} zoom={16} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Polyline positions={plan.geometry} pathOptions={{ color: "#04131f", weight: 10, opacity: 0.9 }} />
            <Polyline positions={plan.geometry} pathOptions={{ color: "#22d3ee", weight: 6, opacity: 0.95 }} />
            <Marker position={[position.lat, position.lng]} icon={currentIcon} />
            <Marker position={[plan.destination.lat, plan.destination.lng]} icon={destinationIcon} />
            <FollowCamera point={position} />
          </MapContainer>
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><RouteIcon className="size-3.5" /> ประกาศทุก {milestoneKmRef.current} กม.</span>
        <button type="button" className="flex items-center gap-1 font-medium text-foreground" onClick={() => speakRef.current?.(`เส้นทางไป ${plan?.label || request?.destination} เหลือ ${formatKm(remaining ?? plan?.distance ?? 0)}`)}><Volume2 className="size-3.5" /> ฟังสรุป</button>
      </div>
    </div>
  );
}

export default NavigationOverlay;
