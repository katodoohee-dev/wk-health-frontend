import { useState } from "react";
import { ChevronDown, Mic, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoicePanel, type VoiceState } from "./voice";
import { MusicMiniPlayer } from "./music-player";
import { track } from "@/lib/wk-data";

const order: VoiceState[] = ["idle", "listening", "thinking", "speaking"];

function CollapseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <ChevronDown className="size-4" aria-hidden="true" />
    </button>
  );
}

export function FloatingDock() {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const cycle = () => setState((s) => order[(order.indexOf(s) + 1) % order.length]!);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-end gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] sm:px-8 lg:pb-6">
        <div className="pointer-events-auto w-full max-w-sm">
          {musicOpen ? (
            <div className="animate-rise">
              <div className="panel flex items-center justify-between gap-2 px-3 py-1.5 shadow-float">
                <p className="eyebrow truncate">Now playing</p>
                <CollapseButton label="Collapse music player" onClick={() => setMusicOpen(false)} />
              </div>
              <MusicMiniPlayer className="mt-2 shadow-float" />
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMusicOpen(true)}
                aria-expanded={false}
                className="flex h-11 max-w-[15rem] items-center gap-2 rounded-full border border-border bg-surface/95 px-3 shadow-lift backdrop-blur-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Music2 className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate text-xs font-medium">{track.title}</span>
              </button>
            </div>
          )}
        </div>

        <div className="pointer-events-auto w-full max-w-sm">
          {voiceOpen ? (
            <div className="animate-rise">
              <div className="panel flex items-center justify-between gap-2 px-3 py-1.5 shadow-float">
                <p className="eyebrow truncate">Voice control</p>
                <CollapseButton label="Collapse voice control" onClick={() => setVoiceOpen(false)} />
              </div>
              <div className="mt-2 shadow-float">
                <VoicePanel state={state} onCycle={cycle} />
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setVoiceOpen(true)}
                aria-expanded={false}
                aria-label="Open voice control"
                className={cn(
                  "grid size-11 place-items-center rounded-full border border-border bg-foreground text-background shadow-float transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                  state !== "idle" && "animate-breathe",
                )}
              >
                <Mic className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
