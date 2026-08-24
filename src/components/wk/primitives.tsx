import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>;
}

export function Chip({ children, tone = 'default', className = '' }: { children: ReactNode; tone?: 'default' | 'signal' | 'solid'; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]', tone === 'signal' && 'border-signal/30 bg-signal/10 text-foreground', tone === 'solid' && 'border-foreground bg-foreground text-background', className)}>{children}</span>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cn('panel', className)}>{children}</section>;
}

export function Metric({ label, value, unit, delta, trend, className = '' }: { label: string; value: ReactNode; unit?: string; delta?: string; trend?: 'up' | 'down' | 'flat'; className?: string }) {
  return <div className={cn('min-w-0', className)}><Eyebrow>{label}</Eyebrow><div className="numeric mt-2 text-3xl leading-none">{value}</div>{unit && <span className="mt-2 block text-[10px] text-muted-foreground">{unit}</span>}{delta && <span className={cn('mt-2 inline-block text-[9px] uppercase tracking-[0.12em] text-muted-foreground', trend === 'up' && 'text-signal')}>{delta}</span>}</div>;
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="flex items-end justify-between gap-4 border-b border-border pb-4"><div><Eyebrow>{eyebrow}</Eyebrow><h2 className="display mt-1 text-3xl">{title}</h2></div>{action}</div>;
}

export function ProgressRing({ value, goal, label, unit, size = 112 }: { value: number; goal: number; label: string; unit?: string; size?: number }) {
  const pct = Math.max(0, Math.min(100, goal > 0 ? (value / goal) * 100 : 0));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  return <div className="flex flex-col items-center gap-3" style={{ width: size }}><div className="relative" style={{ width: size, height: size }}><svg viewBox="0 0 100 100" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-border"/><circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" className="text-foreground transition-all" strokeDasharray={`${dash} ${circumference - dash}`}/></svg><div className="absolute inset-0 grid place-items-center text-center"><div><div className="numeric text-lg">{Math.round(value)}</div><div className="text-[8px] text-muted-foreground">/{Math.round(goal)}</div></div></div></div><div className="text-center"><div className="text-[10px] font-medium uppercase tracking-[0.1em]">{label}</div>{unit && <div className="text-[9px] text-muted-foreground">{unit}</div>}</div></div>;
}

export type BarItem = { day: string; value: number };
export function BarSeries({ items, className = '' }: { items: BarItem[]; className?: string }) {
  const max = Math.max(...items.map(i => Number(i.value) || 0), 1);
  return <div className={cn('flex h-48 items-end gap-2 border-b border-border px-1 pt-4', className)}>{items.map((item, i) => { const h = Math.max(4, ((Number(item.value) || 0) / max) * 100); return <div key={`${item.day}-${i}`} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="w-full rounded-t-sm bg-foreground transition-[height] duration-500" style={{ height: `${h}%` }} title={`${item.day}: ${item.value}`} /><span className="numeric truncate text-center text-[8px] text-muted-foreground">{item.day}</span></div>; })}</div>;
}

export function StackedBar({ segments }: { segments: { label?: string; value?: number; percent?: number }[] }) {
  const total = Math.max(1, segments.reduce((sum, x) => sum + Number(x.percent ?? x.value ?? 0), 0));
  return <div className="space-y-2"><div className="flex h-3 overflow-hidden rounded-full bg-border">{segments.map((segment, i) => <span key={`${segment.label ?? 'segment'}-${i}`} className="bg-foreground" style={{ width: `${Math.max(0, (Number(segment.percent ?? segment.value ?? 0) / total) * 100)}%`, opacity: 0.25 + (i % 3) * 0.25 }} />)}</div><div className="flex flex-wrap gap-3">{segments.map((segment, i) => <span key={`${segment.label ?? 'legend'}-${i}`} className="text-[9px] text-muted-foreground">{segment.label ?? `Stage ${i + 1}`}</span>)}</div></div>;
}
