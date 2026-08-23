import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export function Panel({ children, className = '', ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return <section className={`panel p-5 ${className}`} {...props}>{children}</section>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="display mt-2 text-5xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </header>;
}

export function StatusIndicator({ label, state = 'live' }: { label: string; state?: 'live' | 'warn' | 'error' | string }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[9px] font-semibold tracking-[.12em]">
    <i className={`size-1.5 rounded-full ${state === 'live' ? 'bg-signal' : state === 'warn' ? 'bg-yellow-500' : 'bg-destructive'}`} />{label}
  </span>;
}

export function Action({ children, className = '', size = 'md', ...props }: { children: ReactNode; className?: string; size?: 'sm' | 'md' | 'lg' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = { sm: 'px-3 py-2 text-[10px]', md: 'px-4 py-2.5 text-xs', lg: 'px-5 py-3 text-sm' };
  return <button className={`rounded-full bg-foreground text-background disabled:cursor-not-allowed disabled:opacity-40 ${sizes[size]} ${className}`} {...props}>{children}</button>;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) { return <div className="panel p-8 text-center text-sm text-muted-foreground">{label}</div>; }
export function ErrorState({ label = 'Something went wrong', body }: { label?: string; body?: string }) { return <div className="panel border-destructive/30 p-8"><p className="eyebrow">{label}</p>{body && <p className="mt-2 text-sm text-muted-foreground">{body}</p>}</div>; }
export function EmptyState({ label = 'No records yet', body }: { label?: string; body?: string }) { return <div className="py-12 text-center"><p className="eyebrow">{label}</p>{body && <p className="mt-2 text-sm text-muted-foreground">{body}</p>}</div>; }

export function Metric({ label, value, unit = '', delta, trend }: { label: ReactNode; value: ReactNode; unit?: ReactNode; delta?: ReactNode; trend?: ReactNode }) {
  return <div><p className="eyebrow">{label}</p><div className="numeric mt-2 text-4xl">{value} <small className="text-[9px] text-muted-foreground">{unit}</small></div>{delta && <p className="mt-2 text-[9px] text-muted-foreground">{delta} {trend ? `· ${trend}` : ''}</p>}</div>;
}
