import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Navigation, LocateFixed } from "lucide-react";
import "./live-track-map.css";

/**
 * LiveTrackMap — แผนที่ GPS สด ต่อยอดจากดีไซน์ที่ Lovable สร้างไว้ (mock)
 * แทนที่ mock ด้วยข้อมูลจริงจาก:
 *   - Geolocation API (watchPosition) → พิกัด, ความเร็ว, ทิศทาง
 *   - ก้าวเดิน: รับเป็น props จากระบบนับก้าวเดิม (เช่น DeviceMotionEvent) ของแอพ
 *
 * วิธีใช้:
 *   <LiveTrackMap
 *     steps={currentSteps}
 *     onSessionEnd={(summary) => { ...บันทึกลง DB... }}
 *   />
 */

// ---------- types ----------

type TrackPoint = {
  lat: number;
  lng: number;
  /** km/h */
  speed: number;
  timestamp: number;
};

type LiveTrackMapProps = {
  /** จำนวนก้าวปัจจุบัน จากระบบนับก้าวเดิมของแอพ */
  steps: number;
  /** เรียกเมื่อผู้ใช้กดหยุด session (ถ้าไม่ส่งมา จะไม่แสดงปุ่มหยุด) */
  onSessionEnd?: (summary: {
    distanceKm: number;
    durationSec: number;
    steps: number;
    avgSpeedKmh: number;
    track: TrackPoint[];
  }) => void;
};

// ---------- helpers ----------

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin((b.lng - a.lng) * (Math.PI / 180)) * Math.cos(b.lat * (Math.PI / 180));
  const x =
    Math.cos(a.lat * (Math.PI / 180)) * Math.sin(b.lat * (Math.PI / 180)) -
    Math.sin(a.lat * (Math.PI / 180)) *
      Math.cos(b.lat * (Math.PI / 180)) *
      Math.cos((b.lng - a.lng) * (Math.PI / 180));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const SPEED_MIN = 0.5;
const SPEED_MAX = 15;

/** ช้า(แดง/ส้ม) -> เร็ว(มินท์) */
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
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------- GPS hook ----------

function useLiveGps() {
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<TrackPoint | null>(null);
  const smoothedHeading = useRef(0);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("อุปกรณ์นี้ไม่รองรับ GPS");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed: rawSpeed, heading: rawHeading } = pos.coords;
        const point: TrackPoint = {
          lat: latitude,
          lng: longitude,
          // GPS ให้ speed เป็น m/s แปลงเป็น km/h
          speed: rawSpeed != null && rawSpeed >= 0 ? rawSpeed * 3.6 : 0,
          timestamp: pos.timestamp,
        };

        const prev = lastPointRef.current;
        if (prev) {
          // กรองจุดที่กระโดดผิดปกติ (GPS drift) — ถ้าห่างเกิน 100m ใน <2วิ ให้ข้าม
          const distKm = haversineKm(prev, point);
          const dtSec = (point.timestamp - prev.timestamp) / 1000;
          if (dtSec > 0 && distKm / (dtSec / 3600) > 40 && distKm > 0.05) {
            return; // ข้ามจุดนี้ ถือว่าเป็น noise
          }
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
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setError("ไม่มีสิทธิ์เข้าถึงตำแหน่ง GPS");
        else if (err.code === err.POSITION_UNAVAILABLE) setError("ไม่สามารถระบุตำแหน่งได้");
        else if (err.code === err.TIMEOUT) setError("หาสัญญาณ GPS หมดเวลา");
        else setError("เกิดข้อผิดพลาดกับ GPS");
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const distanceKm = useMemo(() => {
    let d = 0;
    for (let i = 1; i < track.length; i++) d += haversineKm(track[i - 1], track[i]);
    return d;
  }, [track]);

  const avgSpeedKmh = useMemo(() => {
    const durationHr = (Date.now() - startedAt) / 1000 / 3600;
    return durationHr > 0 ? distanceKm / durationHr : 0;
  }, [distanceKm, startedAt]);

  return {
    track,
    currentPos: track.length ? track[track.length - 1] : null,
    heading,
    speed,
    distanceKm,
    avgSpeedKmh,
    startedAt,
    error,
  };
}

// ---------- map sub-components ----------

const arrowIcon = L.divIcon({
  className: "!bg-transparent !border-0",
  iconSize: [72, 72],
  iconAnchor: [36, 36],
  html: `
    <div class="gps-puck">
      <span class="gps-halo"></span>
      <span class="gps-halo gps-halo-2"></span>
      <span class="gps-arrow">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5 20 21l-8-4.6L4 21z"/>
        </svg>
      </span>
    </div>`,
});

function LiveMarker({
  pos,
  heading,
  follow,
  recenterKey,
}: {
  pos: { lat: number; lng: number };
  heading: number;
  follow: boolean;
  recenterKey: number;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    const el = markerRef.current?.getElement()?.querySelector<HTMLElement>(".gps-arrow");
    if (!el) return;
    el.style.transform = `rotate(${heading.toFixed(2)}deg)`;
  }, [heading]);

  useEffect(() => {
    if (follow) map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.7 });
  }, [follow, map, pos.lat, pos.lng]);

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
  if (values.length < 2) {
    return <div className="h-10 w-full" />;
  }
  const w = 260;
  const h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const cursorX = live * w;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.78 0.13 200)" />
          <stop offset="100%" stopColor="oklch(0.86 0.14 168)" />
        </linearGradient>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.14 168)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="oklch(0.86 0.14 168)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#sparkFill)" />
      <path d={d} fill="none" stroke="url(#spark)" strokeWidth="1.6" strokeLinejoin="round" />
      <line
        x1={cursorX}
        y1="0"
        x2={cursorX}
        y2={h}
        stroke="oklch(0.86 0.14 168)"
        strokeWidth="1"
        strokeDasharray="2 3"
        opacity="0.7"
      />
    </svg>
  );
}

// ---------- main component ----------

export function LiveTrackMap({ steps, onSessionEnd }: LiveTrackMapProps) {
  const { track, currentPos, heading, speed, distanceKm, avgSpeedKmh, startedAt, error } = useLiveGps();
  const [follow, setFollow] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setDurationSec(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const segments = useMemo(
    () =>
      track.slice(0, -1).map((p, i) => ({
        positions: [
          [p.lat, p.lng],
          [track[i + 1].lat, track[i + 1].lng],
        ] as [number, number][],
        color: speedColor((p.speed + track[i + 1].speed) / 2),
      })),
    [track],
  );

  const speedValues = useMemo(() => track.map((p) => p.speed), [track]);
  const progress = 1; // ณ ปัจจุบันคือจุดล่าสุดของเส้นทางเสมอ

  const handleEnd = useCallback(() => {
    onSessionEnd?.({
      distanceKm,
      durationSec,
      steps,
      avgSpeedKmh,
      track,
    });
  }, [onSessionEnd, distanceKm, durationSec, steps, avgSpeedKmh, track]);

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
      <div
        className={`absolute inset-0 transition-all duration-[1200ms] ease-out ${
          ready ? "scale-100 opacity-100 blur-0" : "scale-[1.08] opacity-0 blur-sm"
        }`}
      >
        <MapContainer center={center} zoom={15} zoomControl={false} attributionControl={false} className="h-full w-full">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <IntroZoom center={center} />

          {track.length > 1 && (
            <Polyline
              positions={track.map((p) => [p.lat, p.lng]) as [number, number][]}
              pathOptions={{ color: "oklch(0.86 0.14 168)", weight: 14, opacity: 0.12, lineCap: "round" }}
            />
          )}
          {segments.map((s, i) => (
            <Polyline key={i} positions={s.positions} pathOptions={{ color: s.color, weight: 5, opacity: 0.95, lineCap: "round" }} />
          ))}

          {track.length > 0 && (
            <CircleMarker
              center={[track[0].lat, track[0].lng]}
              radius={6}
              pathOptions={{ color: "oklch(0.78 0.13 200)", fillColor: "oklch(0.24 0.06 200)", fillOpacity: 1, weight: 2.5 }}
            />
          )}

          <LiveMarker pos={currentPos} heading={heading} follow={follow} recenterKey={recenterKey} />
        </MapContainer>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-background/80 to-transparent" />

      <div className="glass absolute top-4 left-4 flex items-center gap-2 rounded-full px-3.5 py-2">
        <span className="size-2 animate-pulse rounded-full bg-mint" />
        <span className="text-[11px] tracking-[0.18em] text-foreground/70 uppercase">live tracking</span>
      </div>

      <div className="absolute top-4 right-4 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setRecenterKey((k) => k + 1)}
          aria-label="กลับไปที่ตำแหน่งของฉัน"
          className="glass flex size-12 items-center justify-center rounded-2xl text-mint transition-transform active:scale-90 hover:scale-105"
        >
          <Crosshair className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setFollow((f) => !f)}
          aria-pressed={follow}
          aria-label="สลับโหมดติดตาม"
          className={`glass flex size-12 items-center justify-center rounded-2xl transition-transform active:scale-90 hover:scale-105 ${
            follow ? "text-deep" : "text-foreground/60"
          }`}
          style={follow ? { background: "var(--gradient-orb)" } : undefined}
        >
          {follow ? <LocateFixed className="size-5" /> : <Navigation className="size-5" />}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5">
        <div className="glass animate-rise-in w-full max-w-[440px] rounded-[28px] p-4 shadow-[var(--shadow-glow)]">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] tracking-[0.2em] text-mint/75 uppercase">distance</p>
              <p className="font-display text-5xl leading-none font-semibold tracking-tight">
                {distanceKm.toFixed(2)}
                <span className="ml-1 text-base font-medium text-foreground/50">km</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] tracking-[0.2em] text-aqua/75 uppercase">pace now</p>
              <p className="font-display text-3xl leading-none font-semibold text-aurora">
                {paceLabel(speed)}
                <span className="ml-1 text-xs font-medium text-foreground/45">/km</span>
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "เวลา", value: formatDuration(durationSec) },
              { label: "ก้าว", value: steps.toLocaleString() },
              { label: "เฉลี่ย", value: `${avgSpeedKmh.toFixed(1)} km/h` },
            ].map((s) => (
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
            <button
              type="button"
              onClick={handleEnd}
              className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-deep transition-transform active:scale-95"
              style={{ background: "var(--gradient-orb)" }}
            >
              จบการวิ่ง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveTrackMap;
