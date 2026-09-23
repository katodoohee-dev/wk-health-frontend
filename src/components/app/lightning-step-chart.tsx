import { useMemo, useRef, useState } from "react";

type StepDatum = { day: string; steps: number };

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const bigint = parseInt(full, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function shade(hex: string, amt: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + amt, g + amt, b + amt);
}

function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(255 * f(0), 255 * f(8), 255 * f(4));
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

const PRESETS = ["#7dd3fc", "#a78bfa", "#f472b6", "#22d3ee", "#facc15", "#4ade80", "#fb923c", "#f87171"];

export function LightningStepChart({ data }: { data: StepDatum[] }) {
  const [color, setColor] = useState("#7dd3fc");
  const [pickerOpen, setPickerOpen] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  const W = 320;
  const H = 120;
  const PAD = 10;
  const max = Math.max(1, ...data.map((d) => d.steps));

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: data.length > 1 ? PAD + (i * (W - PAD * 2)) / (data.length - 1) : W / 2,
        y: H - PAD - (d.steps / max) * (H - PAD * 2),
        steps: d.steps,
        day: d.day,
      })),
    [data, max],
  );

  const path = smoothPath(points);
  const glowDark = shade(color, -70);
  const gid = "lightning-grad-" + color.replace("#", "");

  function pickFromWheel(e: React.MouseEvent<HTMLDivElement>) {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    setColor(hslToHex(angle, 90, 62));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-black/30"
        >
          <span className="size-3.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          เลือกสีสายฟ้า
        </button>
      </div>

      {pickerOpen && (
        <div className="mb-3 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div
            ref={wheelRef}
            onClick={pickFromWheel}
            className="size-28 shrink-0 cursor-pointer rounded-full ring-2 ring-white/10"
            style={{ background: "conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)" }}
            role="button"
            aria-label="วงล้อเลือกสีสายฟ้า"
          />
          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="size-6 rounded-full ring-1 ring-white/20 transition hover:scale-110"
                style={{ background: c, boxShadow: color === c ? `0 0 10px ${c}` : undefined }}
                aria-label={`เลือกสี ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="h-40 w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={glowDark} />
              <stop offset="55%" stopColor={color} />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <filter id="lightning-blur-wide" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <filter id="lightning-blur-med" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>

          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD}
              x2={W - PAD}
              y1={H - PAD - f * (H - PAD * 2)}
              y2={H - PAD - f * (H - PAD * 2)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}

          <path d={path} fill="none" stroke={color} strokeWidth={14} opacity={0.22} filter="url(#lightning-blur-wide)" strokeLinecap="round" />
          <path d={path} fill="none" stroke={color} strokeWidth={7} opacity={0.35} filter="url(#lightning-blur-med)" strokeLinecap="round" />
          <path d={path} fill="none" stroke={glowDark} strokeWidth={3.5} opacity={0.55} strokeLinecap="round" transform="translate(1.5,2.5)" />
          <path d={path} fill="none" stroke={`url(#${gid})`} strokeWidth={2.6} strokeLinecap="round" />
          <path d={path} fill="none" stroke="#ffffff" strokeWidth={0.9} opacity={0.75} strokeLinecap="round" transform="translate(0,-0.6)" />

          {points.map((p) => (
            <g key={p.day}>
              <circle cx={p.x} cy={p.y} r={5} fill={color} opacity={0.25} filter="url(#lightning-blur-med)" />
              <circle cx={p.x} cy={p.y} r={2.2} fill="#ffffff" stroke={color} strokeWidth={1} />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {points.map((p) => (
          <span key={p.day}>{p.day}</span>
        ))}
      </div>
    </div>
  );
}