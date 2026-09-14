import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Navigation, LocateFixed, Flag } from "lucide-react";
import { bearingDeg as bearing, haversineKm, compassThai, type GeoResult } from "@/lib/geo";
import { apiFriendLocationPublish } from "@/lib/api-new-features";
import "./live-track-map.css";

type TrackPoint = { lat: number; lng: number; speed: number; timestamp: number; };

type LiveTrackMapProps = {
  steps: number;
  onSessionEnd?: (summary: { distanceKm: number; durationSec: number; steps: number; avgSpeedKmh: number; track: TrackPoint[]; }) => void;
  /** หมุดเป้าหมายจาก "มาร์กเป้าหมาย/นำทางไป..." (ปักผ่านเสียงหรือปุ่มก็ได้) */
  destination?: GeoResult | null;
  /** เป้าหมายระยะทาง (กม.) จาก "อยากวิ่งกี่กิโล" — โชว์ progress + พูดประกาศตอนถึงเป้า */
  goalKm?: number | null;
  /** FIX: เพิ่มใหม่ — ตำแหน่งเพื่อนที่แชร์ให้เห็น (จาก apiFriendLocations) แสดงเป็นหมุดบนแผนที่ */
  friendLocations?: { friendId: string; name: string; avatar?: string; lat: number; lng: number }[];
  /** FIX: เพิ่มใหม่ — avatar ของตัวเอง (emoji หรือรูปที่อัปโหลด/data URL) โชว์ในหมุดตำแหน่งตัวเองบนแผนที่
      ตอนแชร์ตำแหน่งให้เพื่อนเห็น ให้ดูเท่ขึ้นแทนลูกศรเฉยๆ */
  selfAvatar?: string;
  /** FIX: เพิ่มใหม่ — บั๊กใหญ่ 🔴 เดิมต่อให้เปิดสวิตช์ "แชร์ตำแหน่งให้เพื่อน" แล้ว ไม่มีจุดไหนในระบบเรียก
      apiFriendLocationPublish ส่งพิกัดตัวเองขึ้นเซิร์ฟเวอร์เลยสักครั้ง เพื่อนเลยไม่เห็นหมุดตลอดไป
      ไม่ว่าจะกดแชร์กี่รอบก็ตาม — ต้องส่ง shareEnabled เข้ามาจากหน้า pedometer (อ่านจาก
      apiFriendLocationSharingStatus) แล้ว useLiveGps ด้านล่างจะยิงตำแหน่งขึ้นเซิร์ฟเวอร์ให้เองทุก ~8 วิ */
  shareEnabled?: boolean;
};

/** avatar ที่อัปโหลดเป็นรูปจะถูกเก็บเป็น data URL หรือลิงก์ http(s) ส่วน emoji เป็น string สั้นๆ ธรรมดา
    ใช้แยกว่าจะ render เป็น <img> หรือ <span>{emoji}</span> */
function isImageAvatar(a?: string) {
  return !!a && (a.startsWith("data:image") || a.startsWith("http://") || a.startsWith("https://"));
}

const SPEED_MIN = 0.5;
const SPEED_MAX = 15;
// RESTORE: กลับมาใช้เส้นทางไล่สีรุ้งตามความเร็ว (hue 25→165) แทนสีเทาล้วน — ตามที่ขอให้เอา
// เวอร์ชันเก่าที่แผนที่เป็นขาวดำ (กรองผ่าน CSS grayscale ใน monochrome-overrides.css) แต่มี
// แสงสีรุ้งไล่ตามความเร็ววิ่งพาดอยู่บนเส้นทางกลับมา ตอนวิ่งช้า = สีส้ม/แดง วิ่งเร็ว = สีเขียว/ฟ้า
function speedColor(speedKmh: number) {
  const t = Math.min(1, Math.max(0, (speedKmh - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)));
  const hue = 25 + t * 140;
  return `oklch(0.78 0.16 ${hue.toFixed(1)})`;
}
function paceLabel(kmh: number) {
  if (!kmh || kmh < 0.3) return "--'--\"";
  const secPerKm = 3600 / kmh;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${s.toString().padStart(2, "0")}"`;
}
function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
}

function useLiveGps(shareEnabled?: boolean) {
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<TrackPoint | null>(null);
  const smoothedHeading = useRef(0);
  const shareEnabledRef = useRef(shareEnabled);
  const lastPublishAtRef = useRef(0);
  useEffect(() => { shareEnabledRef.current = shareEnabled; }, [shareEnabled]);

  useEffect(() => {
    if (!("geolocation" in navigator)) { setError("อุปกรณ์นี้ไม่รองรับ GPS"); return; }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed: rawSpeed, heading: rawHeading } = pos.coords;
        const point: TrackPoint = { lat: latitude, lng: longitude, speed: rawSpeed != null && rawSpeed >= 0 ? rawSpeed * 3.6 : 0, timestamp: pos.timestamp };
        const prev = lastPointRef.current;
        if (prev) {
          const distKm = haversineKm(prev, point);
          const dtSec = (point.timestamp - prev.timestamp) / 1000;
          if (dtSec > 0 && distKm / (dtSec / 3600) > 40 && distKm > 0.05) { return; }
          const computedHeading = distKm > 0.001 ? bearing(prev, point) : smoothedHeading.current;
          let delta = ((computedHeading - smoothedHeading.current + 540) % 360) - 180;
          smoothedHeading.current += delta;
          setHeading(smoothedHeading.current);
        } else if (rawHeading != null) {
          smoothedHeading.current = rawHeading;
          setHeading(rawHeading);
        }
        lastPointRef.current = point;
        setSpeed(point.speed);
        setTrack((t) => [...t, point]);

        // FIX: เพิ่มใหม่ — ส่งพิกัดขึ้นเซิร์ฟเวอร์ให้เพื่อนเห็นจริงๆ (throttle ทุก 8 วิ กันยิงถี่เกิน)
        // accuracy เป็น required field จริงฝั่ง server (ดูคอมเมนต์ที่ api-new-features.ts) ถ้ารอบนี้
        // เบราว์เซอร์ไม่ได้ค่า accuracy มาด้วย (null) ข้ามรอบนี้ไปเลย ไม่ส่งค่ามั่วๆ ให้ server ปฏิเสธ
        if (shareEnabledRef.current && accuracy != null && Date.now() - lastPublishAtRef.current >= 8000) {
          lastPublishAtRef.current = Date.now();
          void apiFriendLocationPublish({
            lat: latitude,
            lng: longitude,
            accuracy,
            heading: rawHeading ?? undefined,
            speedMps: rawSpeed ?? undefined,
          }).catch(() => {
            // แชร์ไม่สำเร็จรอบนี้ (เช่นปิด sharing ไปพอดี) ไม่ต้องขึ้น error รบกวนตอนวิ่งอยู่ รอบหน้าลองใหม่เอง
          });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setError("ไม่มีสิทธิ์เข้าถึงตำแหน่ง GPS");
        else if (err.code === err.POSITION_UNAVAILABLE) setError("ไม่สามารถระบุตำแหน่งได้");
        else if (err.code === err.TIMEOUT) setError("หาสัญญาณ GPS หมดเวลา");
        else setError("เกิดข้อผิดพลาดกับ GPS");
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  const distanceKm = useMemo(() => { let d = 0; for (let i = 1; i < track.length; i++) d += haversineKm(track[i - 1]!, track[i]!); return d; }, [track]);
  const avgSpeedKmh = useMemo(() => { const durationHr = (Date.now() - startedAt) / 1000 / 3600; return durationHr > 0 ? distanceKm / durationHr : 0; }, [distanceKm, startedAt]);

  return { track, currentPos: track.length ? track[track.length - 1] : null, heading, speed, distanceKm, avgSpeedKmh, startedAt, error };
}

// FIX: เพิ่มใหม่ — ถ้ามีรูปโปรไฟล์จริง (data URL/http) ให้โชว์รูปในหมุดตำแหน่งตัวเองแทนลูกศรเฉยๆ
// ดูเท่ขึ้นตอนแชร์ตำแหน่งให้เพื่อนเห็น ลูกศรทิศทางยังคงอยู่แต่ย่อเป็นป้ายเล็กมุมขวาล่างของรูปแทน
function createArrowIcon(avatar?: string) {
  const hasPhoto = isImageAvatar(avatar);
  const photoHtml = hasPhoto
    ? `<img src="${avatar}" alt="" class="gps-self-photo" />
       <span class="gps-arrow gps-arrow-badge">
         <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
           <path d="M12 2.5 20 21l-8-4.6L4 21z"/>
         </svg>
       </span>`
    : `<span class="gps-arrow">
         <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
           <path d="M12 2.5 20 21l-8-4.6L4 21z"/>
         </svg>
       </span>`;
  return L.divIcon({
    className: "!bg-transparent !border-0",
    iconSize: [72, 72],
    iconAnchor: [36, 36],
    html: `
    <div class="gps-puck">
      <span class="gps-halo"></span>
      <span class="gps-halo gps-halo-2"></span>
      ${photoHtml}
    </div>`,
  });
}

// FIX: เพิ่มใหม่ — หมุดเพื่อน สร้างแบบ lazy เหมือน createArrowIcon (ห้ามสร้าง L.divIcon ตอน module
// load เพราะ Leaflet ต้องการ window/document ซึ่งไม่มีตอน SSR — ดู commit d350ec5 ที่เคยแก้บั๊กนี้)
// RESTORE: รองรับ avatar ที่เป็นรูปจริง (ไม่ใช่แค่ emoji) ให้หมุดเพื่อนดูเท่ขึ้นเหมือนหมุดตัวเอง
const friendIconCache = new Map<string, L.DivIcon>();
function friendDivIcon(avatar: string) {
  const cached = friendIconCache.get(avatar);
  if (cached) return cached;
  const inner = isImageAvatar(avatar) ? `<img src="${avatar}" alt="" class="gps-friend-photo" />` : `<span>${avatar}</span>`;
  const icon = L.divIcon({
    className: "!bg-transparent !border-0",
    iconSize: [40, 40],
    iconAnchor: [20, 36],
    html: `<div class="gps-friend-pin">${inner}</div>`,
  });
  friendIconCache.set(avatar, icon);
  return icon;
}

function LiveMarker({ pos, heading, follow, recenterKey, avatar }: { pos: { lat: number; lng: number }; heading: number; follow: boolean; recenterKey: number; avatar?: string; }) {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);
  const arrowIcon = useMemo(() => createArrowIcon(avatar), [avatar]);

  useEffect(() => {
    const el = markerRef.current?.getElement()?.querySelector<HTMLElement>(".gps-arrow");
    if (!el) return;
    el.style.transform = `rotate(${heading.toFixed(2)}deg)`;
  }, [heading]);

  useEffect(() => { if (follow) map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.7 }); }, [follow, map, pos.lat, pos.lng]);
  useEffect(() => {
    if (recenterKey > 0) map.flyTo([pos.lat, pos.lng], 16, { duration: 1.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  return <Marker position={[pos.lat, pos.lng]} icon={arrowIcon} ref={markerRef} />;
}

function IntroZoom({ center }: { center: [number, number] | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!center || done.current) return;
    done.current = true;
    map.setView(center, 15, { animate: false });
    const id = setTimeout(() => map.flyTo(center, 17, { duration: 1.6 }), 120);
    return () => clearTimeout(id);
  }, [center, map]);
  return null;
}

function Sparkline({ values, live }: { values: number[]; live: number }) {
  if (values.length < 2) { return <div className="h-10 w-full" />; }
  const w = 260; const h = 40;
  const min = Math.min(...values); const max = Math.max(...values);
  const pts = values.map((v, i) => { const x = (i / (values.length - 1)) * w; const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3; return [x, y] as const; });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const cursorX = live * w;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="oklch(0.78 0.13 200)" /><stop offset="100%" stopColor="oklch(0.86 0.14 168)" /></linearGradient>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.86 0.14 168)" stopOpacity="0.35" /><stop offset="100%" stopColor="oklch(0.86 0.14 168)" stopOpacity="0" /></linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#sparkFill)" />
      <path d={d} fill="none" stroke="url(#spark)" strokeWidth="1.6" strokeLinejoin="round" />
      <line x1={cursorX} y1="0" x2={cursorX} y2={h} stroke="oklch(0.86 0.14 168)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
    </svg>
  );
}

export function LiveTrackMap({ steps, onSessionEnd, destination, goalKm, friendLocations, selfAvatar, shareEnabled }: LiveTrackMapProps) {
  const { track, currentPos, heading, speed, distanceKm, avgSpeedKmh, startedAt, error } = useLiveGps(shareEnabled);
  const [follow, setFollow] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const goalAnnouncedRef = useRef(false);

  // FIX: เพิ่มใหม่ — "อยากวิ่งกี่กิโล" -> ตั้งเป้าไว้แล้ว พอระยะทางที่วิ่งจริงถึงเป้าหมาย ให้พูดประกาศ
  // ทันที (แยกจากระบบเสียงหลักโดยตั้งใจ เพราะต้องพูดตอนกำลังวิ่งอยู่ ไม่ใช่ตอนตอบคำสั่ง — เรียก
  // SpeechSynthesis ตรงๆ ที่นี่ ไม่ผ่าน VoiceControl เพื่อไม่ต้องพึ่งว่าโหมดฟังเสียงเปิดอยู่หรือไม่)
  useEffect(() => {
    if (!goalKm || goalKm <= 0 || goalAnnouncedRef.current) return;
    if (distanceKm >= goalKm) {
      goalAnnouncedRef.current = true;
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(`ถึงเป้าหมาย ${goalKm} กิโลเมตรแล้วครับ เก่งมาก!`);
        u.lang = "th-TH";
        window.speechSynthesis.speak(u);
      }
    }
  }, [distanceKm, goalKm]);

  useEffect(() => { const id = setTimeout(() => setReady(true), 60); return () => clearTimeout(id); }, []);
  useEffect(() => { const id = setInterval(() => setDurationSec(Math.floor((Date.now() - startedAt) / 1000)), 1000); return () => clearInterval(id); }, [startedAt]);

  const segments = useMemo(() => track.slice(0, -1).map((p, i) => { const next = track[i + 1]!; return { positions: [[p.lat, p.lng], [next.lat, next.lng]] as [number, number][], color: speedColor((p.speed + next.speed) / 2) }; }), [track]);
  const speedValues = useMemo(() => track.map((p) => p.speed), [track]);
  const progress = 1;

  const handleEnd = useCallback(() => { onSessionEnd?.({ distanceKm, durationSec, steps, avgSpeedKmh, track }); }, [onSessionEnd, distanceKm, durationSec, steps, avgSpeedKmh, track]);

  if (error) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background px-6">
        <div className="glass rounded-2xl px-5 py-4 text-center">
          <p className="text-sm text-foreground/80">{error}</p>
          <p className="mt-1 text-xs text-foreground/50">กรุณาเปิดสิทธิ์เข้าถึงตำแหน่งแล้วลองใหม่</p>
        </div>
      </div>
    );
  }

  if (!currentPos) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <div className="glass flex items-center gap-3 rounded-2xl px-5 py-3.5">
          <span className="size-2 animate-pulse rounded-full bg-mint" />
          <span className="text-sm text-foreground/70">กำลังเชื่อมต่อสัญญาณ GPS…</span>
        </div>
      </div>
    );
  }

  const center: [number, number] = [currentPos.lat, currentPos.lng];

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <div className={`absolute inset-0 transition-all duration-[1200ms] ease-out ${ready ? "scale-100 opacity-100 blur-0" : "scale-[1.08] opacity-0 blur-sm"}`}>
        <MapContainer center={center} zoom={15} zoomControl={false} attributionControl={true} className="gps-noir-map h-full w-full">
          {/* FIX: บั๊กใหญ่ 🔴 — CARTO เปลี่ยนนโยบายให้ raster basemap เดิม (basemaps.cartocdn.com)
              ต้องสมัคร API key ก่อนถึงจะใช้ได้ ไม่งั้นจะโชว์ลายน้ำ "API KEY REQUIRED" ทับแผนที่เต็มจอ
              ตามที่เจอในสกรีนช็อต — เปลี่ยนมาใช้ OpenStreetMap standard tiles ซึ่งฟรีไม่ต้องใช้ key
              (ต้องเปิด attribution ตามเงื่อนไขการใช้งานของ OSM ด้วย จึงเปิด attributionControl กลับมา) */}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          <IntroZoom center={center} />
          {track.length > 1 && (<Polyline positions={track.map((p) => [p.lat, p.lng]) as [number, number][]} pathOptions={{ color: "oklch(0.86 0.14 168)", weight: 14, opacity: 0.12, lineCap: "round" }} />)}
          {segments.map((s, i) => (<Polyline key={i} className="gps-track-glow" positions={s.positions} pathOptions={{ color: s.color, weight: 5, opacity: 0.95, lineCap: "round" }} />))}
          {track.length > 0 && (<CircleMarker center={[track[0]!.lat, track[0]!.lng]} radius={6} pathOptions={{ color: "oklch(0.78 0.13 200)", fillColor: "oklch(0.24 0.06 200)", fillOpacity: 1, weight: 2.5 }} />)}
          {/* FIX: เพิ่มใหม่ — หมุดเป้าหมาย (มาร์กจากเสียง/ปุ่ม) + เส้นประจากตำแหน่งปัจจุบันไปยังเป้าหมาย
              (สีส้มเด่นให้ตัดกับเส้นทางไล่สีรุ้ง มองเห็นง่ายว่าไหนคือเป้าหมาย) */}
          {destination && (
            <>
              <Polyline positions={[[currentPos.lat, currentPos.lng], [destination.lat, destination.lng]] as [number, number][]} pathOptions={{ color: "oklch(0.85 0.12 60)", weight: 3, opacity: 0.85, dashArray: "6 8" }} />
              <CircleMarker center={[destination.lat, destination.lng]} radius={9} pathOptions={{ color: "oklch(0.98 0 0)", fillColor: "oklch(0.62 0.2 30)", fillOpacity: 1, weight: 3 }} />
            </>
          )}
          <LiveMarker pos={currentPos} heading={heading} follow={follow} recenterKey={recenterKey} avatar={selfAvatar} />
          {/* FIX: เพิ่มใหม่ — หมุดตำแหน่งเพื่อนที่เปิดแชร์ตำแหน่งไว้ (สีฟ้า-ม่วงให้ต่างจากสีรุ้งของ
              เส้นทางตัวเอง และสีส้มของหมุดเป้าหมาย แยกแยะง่ายว่าอันไหนคือใคร) */}
          {friendLocations?.map((f) => (
            <Marker
              key={f.friendId}
              position={[f.lat, f.lng]}
              icon={friendDivIcon(f.avatar ?? "🙂")}
            />
          ))}
        </MapContainer>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-background/80 to-transparent" />
      <div className="glass absolute top-4 left-4 flex items-center gap-2 rounded-full px-3.5 py-2">
        <span className="size-2 animate-pulse rounded-full bg-mint" />
        <span className="text-[11px] tracking-[0.18em] text-foreground/70 uppercase">live tracking</span>
      </div>
      {destination && (
        <div className="glass absolute top-16 left-4 flex max-w-[75%] items-center gap-2 rounded-2xl px-3.5 py-2.5">
          <Flag className="size-4 shrink-0 text-peach" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{destination.label}</p>
            <p className="text-[11px] text-foreground/60">
              {haversineKm(currentPos, destination).toFixed(1)} กม. · ทิศ{compassThai(bearing(currentPos, destination))}
            </p>
          </div>
        </div>
      )}
      <div className="absolute top-4 right-4 flex flex-col gap-2.5">
        <button type="button" onClick={() => setRecenterKey((k) => k + 1)} aria-label="กลับไปที่ตำแหน่งของฉัน" className="glass flex size-12 items-center justify-center rounded-2xl text-mint transition-transform active:scale-90 hover:scale-105">
          <Crosshair className="size-5" />
        </button>
        <button type="button" onClick={() => setFollow((f) => !f)} aria-pressed={follow} aria-label="สลับโหมดติดตาม" className={`glass flex size-12 items-center justify-center rounded-2xl transition-transform active:scale-90 hover:scale-105 ${follow ? "text-deep" : "text-foreground/60"}`} style={follow ? { background: "var(--gradient-orb)" } : undefined}>
          {follow ? <LocateFixed className="size-5" /> : <Navigation className="size-5" />}
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5">
        <div className="glass animate-rise-in w-full max-w-[440px] rounded-[28px] p-4 shadow-[var(--shadow-glow)]">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] tracking-[0.2em] text-mint/75 uppercase">distance</p>
              <p className="font-display text-5xl leading-none font-semibold tracking-tight">{distanceKm.toFixed(2)}<span className="ml-1 text-base font-medium text-foreground/50">km</span></p>
              {goalKm ? (
                <div className="mt-1.5 w-28">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,white_10%,transparent)]">
                    <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${Math.min(100, (distanceKm / goalKm) * 100)}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-foreground/50">เป้าหมาย {goalKm} km</p>
                </div>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-[10px] tracking-[0.2em] text-aqua/75 uppercase">pace now</p>
              <p className="font-display text-3xl leading-none font-semibold text-aurora">{paceLabel(speed)}<span className="ml-1 text-xs font-medium text-foreground/45">/km</span></p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[{ label: "เวลา", value: formatDuration(durationSec) }, { label: "ก้าว", value: steps.toLocaleString() }, { label: "เฉลี่ย", value: `${avgSpeedKmh.toFixed(1)} km/h` }].map((s) => (
              <div key={s.label} className="rounded-2xl bg-[color-mix(in_oklab,white_6%,transparent)] px-3 py-2.5">
                <p className="text-[10px] tracking-[0.14em] text-foreground/45 uppercase">{s.label}</p>
                <p className="font-display mt-0.5 text-lg leading-none font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] tracking-[0.16em] text-foreground/40 uppercase">speed graph</p>
              <p className="text-[10px] text-foreground/40">{track.length} จุด</p>
            </div>
            <Sparkline values={speedValues} live={progress} />
          </div>
          {onSessionEnd && (
            <button type="button" onClick={handleEnd} className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-deep transition-transform active:scale-95" style={{ background: "var(--gradient-orb)" }}>
              จบการวิ่ง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveTrackMap;
