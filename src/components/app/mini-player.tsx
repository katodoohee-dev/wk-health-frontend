import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Pause, Play, SkipBack, SkipForward, X, Music2 } from "lucide-react";
import { useMusic } from "@/lib/music";

export function MiniPlayer() {
  const { current, isPlaying, toggle, next, prev, stop } = useMusic();

  useEffect(() => {
    const handler = (event: Event) => {
      const action = (event as CustomEvent<{action?: string}>).detail?.action;
      if (action === "play" && !isPlaying) toggle();
      else if (action === "pause" && isPlaying) toggle();
      else if (action === "next") next();
      else if (action === "prev") prev();
      else if (action === "stop") stop();
    };
    window.addEventListener("wk:music", handler);
    return () => window.removeEventListener("wk:music", handler);
  }, [isPlaying, next, prev, stop, toggle]);

  if (!current) return null;

  return (
    <div className="mx-auto mb-2 w-full max-w-md px-4">
      <div className="glass-strong flex items-center gap-2 rounded-3xl p-2 pl-3 shadow-soft">
        <Link to="/music" className="flex min-w-0 flex-1 items-center gap-2">
          <span className={`grid size-9 shrink-0 place-items-center rounded-2xl bg-mint-soft text-mint ${isPlaying ? "animate-pulse" : ""}`}>
            <Music2 className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium">{current.title}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{current.type === "youtube" ? "YouTube" : "ไฟล์เสียง"}</span>
          </span>
        </Link>
        <button onClick={prev} aria-label="เพลงก่อนหน้า" className="press grid size-9 place-items-center rounded-xl"><SkipBack className="size-4" /></button>
        <button onClick={toggle} aria-label={isPlaying ? "หยุดชั่วคราว" : "เล่น"} className="press bg-mint-gradient grid size-10 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-glow">
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button onClick={next} aria-label="เพลงถัดไป" className="press grid size-9 place-items-center rounded-xl"><SkipForward className="size-4" /></button>
        <button onClick={stop} aria-label="ปิดเพลง" className="press grid size-9 place-items-center rounded-xl text-muted-foreground"><X className="size-4" /></button>
      </div>
    </div>
  );
}
