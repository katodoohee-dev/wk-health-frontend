import type { ReactNode } from "react";
import { AlertTriangle, Check, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border pb-4"><div className="min-w-0">{eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}<h2 className="display truncate text-2xl sm:text-3xl">{title}</h2></div>{action ? <div className="shrink-0">{action}</div> : null}</div>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel p-5 sm:p-6", className)}>{children}</div>;
}

export function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "solid" | "signal" }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[.12em] uppercase", tone === "default" && "border-border bg-surface-2 text-muted-foreground", tone === "solid" && "border-foreground bg-foreground text-background", tone === "signal" && "border-border bg-surface text-foreground")}>{tone === "signal" ? <span className="size-1.5 rounded-full bg-foreground" /> : null}{children}</span>;
}

export function Metric({ label, value, unit, delta }: { label: string; value: number | string; unit?: string; delta?: string }) {
  return <div className="flex h-full flex-col justify-between gap-6"><div className="flex items-start justify-between gap-3"><Eyebrow>{label}</Eyebrow>{delta ? <span className="numeric text-xs text-muted-foreground">{delta}</span> : null}</div><div className="flex items-baseline gap-1.5"><span className="numeric text-4xl font-medium sm:text-5xl">{value}</span>{unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}</div></div>;
}

export function LoadingState({ label = "Syncing" }: { label?: string }) {
  return <div className="panel grain flex items-center gap-2 p-5 text-sm text-muted-foreground" aria-busy="true" aria-live="polite"><Loader2 className="size-4 animate-spin" />{label}</div>;
}
export function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center"><span className="grid size-10 place-items-center rounded-full border border-border"><Inbox className="size-4 text-muted-foreground" /></span><h3 className="display text-xl">{title}</h3><p className="max-w-sm text-sm text-muted-foreground">{body}</p></div>;
}
export function ErrorState({ title = "Something went wrong", body = "Try again in a moment.", action }: { title?: string; body?: string; action?: ReactNode }) {
  return <div className="panel flex gap-4 border-destructive/30 p-5" role="alert"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-destructive/40"><AlertTriangle className="size-4 text-destructive" /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{body}</p>{action ? <div className="mt-4">{action}</div> : null}</div></div>;
}
export function SuccessState({ title, body }: { title: string; body: string }) {
  return <div className="panel flex gap-4 p-5" role="status"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground"><Check className="size-4 text-background" /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{body}</p></div></div>;
}
