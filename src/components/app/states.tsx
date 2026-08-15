import { Loader2, WifiOff, RefreshCw } from "lucide-react";

export function LoadingState({ label = "กำลังโหลดข้อมูล…" }: { label?: string }) {
  return (
    <div className="glass-strong flex items-center justify-center gap-2 rounded-3xl p-8 text-sm text-muted-foreground shadow-soft">
      <Loader2 className="size-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่รู้จัก กรุณาลองใหม่";
  return (
    <div className="glass-strong rounded-3xl p-6 text-center shadow-soft">
      <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-peach-soft text-peach">
        <WifiOff className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">โหลดข้อมูลไม่สำเร็จ</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      {onRetry ? (
        <button onClick={onRetry} className="press bg-mint-gradient mx-auto mt-4 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-glow">
          <RefreshCw className="size-4" /> ลองใหม่
        </button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted/70 ${className}`} />;
}
