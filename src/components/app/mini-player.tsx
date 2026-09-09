import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pause, Play, SkipBack, SkipForward, X, Music2, Volume2, Volume1, VolumeX } from "lucide-react";
import { useMusic } from "@/lib/music";

export function VolumeControl({ variant = "inline" }: { variant?: "inline" | "fab" }) {
  const { volume, muted, setVolume, toggleMute } = useMusic();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;
  const isFab = variant === "fab";

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onDoubleClick={toggleMute}
        aria-label={muted ? "ปิดเสียงอยู่ กดเพื่อเปิดเสียง" : "ระดับเสียงระบบ"}
        aria-pressed={muted}
        className={isFab ? "wk-floating-fab" : "press grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground"}
      >
        <Icon className={isFab ? "size-5" : "size-4"} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`glass-strong absolute ${isFab ? "bottom-full right-0" : "bottom-full right-0"} mb-2 flex flex-col items-center gap-2 rounded-2xl p-3 shadow-soft`}
        >
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(effective * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            aria-label="ปรับระดับเสียงทั้งระบบ"
            className="h-24 w-2 shrink-0 accent-mint"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
          <button
            onClick={toggleMute}
            className="press grid size-8 place-items-center rounded-lg text-muted-foreground"
            aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

export function MiniPlayer() {
  const { current, isPlaying, toggle, next, prev, stop } = useMusic();
  if (!current) return null;

  return (
    <div className="mx-auto mb-2 w-full max-w-md px-4">
      <div className="glass-strong flex items-center gap-2 rounded-3xl p-2 pl-3 shadow-soft">
        <Link to="/music" className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-2xl bg-mint-soft text-mint ${
              isPlaying ? "animate-pulse" : ""
            }`}
          >
            <Music2 className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium">{current.title}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {current.type === "youtube" ? "YouTube" : "ไฟล์เสียง"}
            </span>
          </span>
        </Link>
        <button onClick={prev} aria-label="เพลงก่อนหน้า" className="press grid size-9 place-items-center rounded-xl">
          <SkipBack className="size-4" />
        </button>
        <button
          onClick={toggle}
          aria-label={isPlaying ? "หยุดชั่วคราว" : "เล่น"}
          className="press bg-mint-gradient grid size-10 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-glow"
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button onClick={next} aria-label="เพลงถัดไป" className="press grid size-9 place-items-center rounded-xl">
          <SkipForward className="size-4" />
        </button>
        <VolumeControl />
        <button onClick={stop} aria-label="ปิดเพลง" className="press grid size-9 place-items-center rounded-xl text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
