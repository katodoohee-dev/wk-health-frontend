import { cn } from "@/lib/utils";
import { Mic, Square, Waves } from "lucide-react";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const copy: Record<VoiceState, { label: string; hint: string }> = {
  idle: { label: "Tap to speak", hint: "WK is standing by" },
  listening: { label: "Listening", hint: "Speak naturally — pause to send" },
  thinking: { label: "Reasoning", hint: "Reading today's signals" },
  speaking: { label: "Responding", hint: "Tap to interrupt" },
};

export function VoiceOrb({
  state,
  size = 96,
  onClick,
}: {
  state: VoiceState;
  size?: number;
  onClick?: () => void;
}) {
  const active = state !== "idle";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copy[state].label}
      aria-pressed={active}
      className="group relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size }}
    >
      {active ? (
        <>
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-border-strong" />
          <span
            className="absolute inset-0 animate-pulse-ring rounded-full border border-border-strong"
            style={{ animationDelay: "1.3s" }}
          />
        </>
      ) : null}
      <span
        className={cn(
          "absolute inset-2 rounded-full border transition-colors duration-500",
          state === "idle" && "border-border bg-surface",
          state === "listening" && "animate-breathe border-foreground bg-foreground",
          state === "thinking" && "border-border-strong bg-surface-2",
          state === "speaking" && "border-foreground bg-surface",
        )}
      />
      {state === "thinking" ? (
        <span className="absolute inset-2 overflow-hidden rounded-full">
          <span className="absolute inset-x-0 h-1/4 animate-scan bg-foreground/12" />
        </span>
      ) : null}
      <span className="relative">
        {state === "listening" ? (
          <Square className="size-5 text-background" aria-hidden="true" />
        ) : state === "speaking" ? (
          <Waves className="size-5 animate-pulse text-foreground" aria-hidden="true" />
        ) : (
          <Mic className="size-5 text-foreground" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}

export function VoicePanel({
  state,
  onCycle,
}: {
  state: VoiceState;
  onCycle: () => void;
}) {
  return (
    <div className="panel grain flex items-center gap-5 p-5">
      <VoiceOrb state={state} onClick={onCycle} />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Voice · {state}</p>
        <p className="display mt-1 truncate text-2xl">{copy[state].label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy[state].hint}</p>
        <div className="mt-4 flex h-6 items-end gap-[3px]" aria-hidden="true">
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "w-[3px] rounded-full bg-foreground transition-all duration-300",
                state === "idle" ? "opacity-20" : "opacity-70",
              )}
              style={{
                height:
                  state === "idle"
                    ? 3
                    : 4 + Math.abs(Math.sin((i + (state === "speaking" ? 2 : 0)) * 0.7)) * 20,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
