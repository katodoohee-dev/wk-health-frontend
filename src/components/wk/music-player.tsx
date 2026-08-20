import { useState } from "react";
import { cn } from "@/lib/utils";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { track } from "@/lib/wk-data";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MusicMiniPlayer({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(true);
  const pct = (track.elapsed / track.duration) * 100;

  return (
    <div className={cn("panel grain overflow-hidden p-0", className)}>
      <div className="flex items-center gap-3 p-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-surface-2" aria-hidden="true">
          <div className="flex items-end gap-[2px]">
            {[8, 14, 6, 11].map((h, i) => (
              <span key={i} className={cn("w-[2px] rounded-full bg-foreground", playing && "animate-pulse")} style={{ height: h, animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{track.title}</p>
          <p className="truncate text-xs text-muted-foreground">{track.artist} · {track.album}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!compact && <button type="button" aria-label="Previous track" className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><SkipBack className="size-4" /></button>}
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="grid size-11 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105">{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
          {!compact && <button type="button" aria-label="Next track" className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><SkipForward className="size-4" /></button>}
        </div>
      </div>
      <div className="flex items-center gap-3 px-3 pb-3"><span className="numeric text-[0.625rem] text-muted-foreground">{fmt(track.elapsed)}</span><div className="h-[3px] flex-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Playback progress" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} /></div><span className="numeric text-[0.625rem] text-muted-foreground">{fmt(track.duration)}</span></div>
    </div>
  );
}
