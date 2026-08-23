import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PedometerMapPoint = { lat: number; lng: number; heading: number };

function distanceM(a: PedometerMapPoint, b: PedometerMapPoint) {
  const R = 6371000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function FollowPosition({ position, heading }: { position: PedometerMapPoint; heading: number }) {
  const map = useMap();
  useEffect(() => {
    const center = map.getCenter();
    if (distanceM({ lat: center.lat, lng: center.lng, heading: 0 }, position) > 3) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.35 });
    }
    const el = document.querySelector<HTMLElement>(".wk-gps-arrow");
    if (el) el.style.transform = `rotate(${heading}deg)`;
  }, [map, position.lat, position.lng, heading]);
  return null;
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

export default function PedometerMap({ points }: { points: PedometerMapPoint[] }) {
  if (!points.length) return <div className="grid h-72 place-items-center rounded-3xl bg-[#07151b] text-sm text-slate-400">กำลังรอสัญญาณ GPS…</div>;
  const last = points[points.length - 1];
  const first = points[0];
  const positions = points.map((p) => [p.lat, p.lng] as [number, number]);
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#07151b] shadow-[0_20px_60px_rgba(0,0,0,.45)]" style={{ height: 380 }}>
      <MapContainer center={[last.lat, last.lng]} zoom={17} scrollWheelZoom className="h-full w-full" zoomControl>
        <TileLayer attribution='&copy; OpenStreetMap contributors &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <Polyline positions={positions} pathOptions={{ color: "rgba(2,8,12,.85)", weight: 11, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
        <Polyline positions={positions} pathOptions={{ color: "#22d3ee", weight: 5, opacity: 0.98, lineCap: "round", lineJoin: "round", className: "wk-route-line" }} />
        <Marker position={[first.lat, first.lng]} icon={startMarker} />
        <Marker position={[last.lat, last.lng]} icon={gpsArrow} />
        <FollowPosition position={last} heading={last.heading} />
      </MapContainer>
    </div>
  );
}
