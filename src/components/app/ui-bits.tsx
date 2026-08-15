import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-strong rounded-3xl shadow-soft ${className}`}>{children}</div>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title, subtitle, emoji, right,
}: { title: string; subtitle?: string; emoji?: string; right?: ReactNode }) {
  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 pt-2 pb-4">
      <Link to="/" aria-label="กลับหน้าแรก" className="press glass grid size-11 shrink-0 place-items-center rounded-2xl shadow-soft">
        <ChevronLeft className="size-5" />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl font-bold">
          {emoji ? <span className="mr-1.5">{emoji}</span> : null}
          {title}
        </h1>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="shrink-0">{right}</div>
    </header>
  );
}

export function Ring({
  value, max, size = 168, stroke = 14, color = "var(--mint)", track = "var(--muted)", children,
}: { value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max === 0 ? 0 : value / max);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - c * pct}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({
  label, value, max, color, unit = "g",
}: { label: string; value: number; max: number; color: string; unit?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums">
          {value}<span className="text-muted-foreground">/{max}{unit}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width 900ms cubic-bezier(0.22,1,0.36,1)" }} />
      </div>
    </div>
  );
}

export function Chip({
  children, active = false, onClick,
}: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`press shrink-0 rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-primary text-primary-foreground shadow-glow" : "glass text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}
