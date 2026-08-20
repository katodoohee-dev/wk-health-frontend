import { Link } from "@tanstack/react-router";
import { Music2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useMusic } from "@/lib/music";

export function MiniPlayer() {
  const { current, isPlaying, toggle, next, prev, stop } = useMusic();
  if (!current) return null;
  return <div className="mx-auto w-full max-w-[1240px] px-0 pb-2 sm:px-0"><div className="panel grain flex items-center gap-3 p-2.5 sm:p-3"><Link to="/music" className="flex min-w-0 flex-1 items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-md border border-border bg-surface-2 ${isPlaying ? "animate-pulse" : ""}`}><Music2 className="size-4"/></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{current.title}</span><span className="eyebrow block truncate">{current.type === "youtube" ? "YouTube" : "Local audio"}</span></span></Link><button onClick={prev} aria-label="เพลงก่อนหน้า" className="press hidden size-10 place-items-center rounded-full text-muted-foreground hover:bg-accent sm:grid"><SkipBack className="size-4"/></button><button onClick={toggle} aria-label={isPlaying ? "หยุดชั่วคราว" : "เล่น"} className="press grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background">{isPlaying?<Pause className="size-4"/>:<Play className="size-4"/>}</button><button onClick={next} aria-label="เพลงถัดไป" className="press hidden size-10 place-items-center rounded-full text-muted-foreground hover:bg-accent sm:grid"><SkipForward className="size-4"/></button><button onClick={stop} aria-label="ปิดเพลง" className="press grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-accent"><X className="size-4"/></button></div></div>;
}
