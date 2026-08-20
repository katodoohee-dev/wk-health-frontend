import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={cn("border border-border bg-card shadow-panel", className)}>{children}</section>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="hairline-b mb-4 flex items-center justify-between gap-3 pb-3"><h2 className="text-[12px] font-semibold uppercase tracking-[0.13em]">{title}</h2>{action}</div>;
}

export function PageHeader({ title, subtitle, emoji, right }: { title: string; subtitle?: string; emoji?: string; right?: ReactNode }) {
  return <header className="hairline-b grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-4 pb-7"><Link to="/" aria-label="กลับหน้าแรก" className="press grid size-8 shrink-0 place-items-center border border-border text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"><ChevronLeft className="size-4"/></Link><div className="min-w-0"><p className="label-xs mb-3">{emoji ? `${emoji} / ` : ""}WK Health</p><h1 className="display truncate text-4xl sm:text-5xl">{title}</h1>{subtitle ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}</div><div className="shrink-0">{right}</div></header>;
}

export function Ring({ value, max, size = 168, stroke = 14, color = "var(--signal)", track = "var(--muted)", children }: { value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const pct = Math.min(1, max === 0 ? 0 : value / max);
  return <div className="relative grid place-items-center" style={{ width: size, height: size }}><svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke}/><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - c * pct} style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)" }}/></svg><div className="absolute inset-0 grid place-items-center text-center">{children}</div></div>;
}

export function Bar({ label, value, max, color = "var(--signal)", unit = "g" }: { label: string; value: number; max: number; color?: string; unit?: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return <div className="min-w-0"><div className="mb-2 flex items-baseline justify-between gap-2 text-xs"><span className="label-xs truncate">{label}</span><span className="num shrink-0 text-[11px]">{value}<span className="text-muted-foreground">/{max}{unit}</span></span></div><div className="h-[3px] w-full bg-foreground/10"><div className="h-full" style={{ width: `${pct}%`, background: color, transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }}/></div></div>;
}

export function Chip({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={cn("press shrink-0 border px-3.5 py-2 text-[11px] font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-foreground/25", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground")}>{children}</button>;
}
