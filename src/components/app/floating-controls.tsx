import { useState } from "react";
import { ChevronDown, Mic, Music2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { apiMe } from "@/lib/api";
import { gpsBridge } from "@/lib/gps-bridge";
import { useMusic } from "@/lib/music";
import { MiniPlayer } from "@/components/app/mini-player";
import VoiceControl from "@/components/VoiceControl";
import "@/components/voice-control.css";

export function FloatingControls() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { current } = useMusic();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, enabled: isAuthenticated });

  if (!isAuthenticated) return null;

  return (
    <>
      <div className="wk-floating-voice" aria-label="Voice control">
        {!voiceOpen ? (
          <button
            type="button"
            aria-label="เปิดระบบควบคุมเสียง"
            aria-expanded={false}
            onClick={() => setVoiceOpen(true)}
            className="wk-floating-fab"
          >
            <Mic className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <div className="wk-floating-panel">
            <button
              type="button"
              aria-label="ย่อระบบควบคุมเสียง"
              onClick={() => setVoiceOpen(false)}
              className="wk-floating-close"
            >
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
            <VoiceControl
              profileName={me.data?.["name"] as string | undefined}
              bodyWeightKg={Number(me.data?.["weightKg"] ?? 60)}
              onExercise={(result) => console.log("[VoiceControl] exercise result:", result)}
              onStartGps={async () => {
                const ok = await gpsBridge.start();
                if (!ok) void navigate({ to: "/pedometer" });
              }}
              onStopGps={async () => {
                await gpsBridge.stop();
              }}
              onOpenProfileModal={() => void navigate({ to: "/profile" })}
            />
          </div>
        )}
      </div>

      {current && (
        <div className="wk-floating-music" aria-label="Mini music player">
          {!musicOpen ? (
            <button
              type="button"
              aria-label="เปิดเครื่องเล่นเพลง"
              aria-expanded={false}
              onClick={() => setMusicOpen(true)}
              className="wk-floating-music-fab"
            >
              <Music2 className="size-5" aria-hidden="true" />
              <span className="wk-floating-track">{current.title}</span>
            </button>
          ) : (
            <div className="wk-floating-panel wk-floating-music-panel">
              <button
                type="button"
                aria-label="ย่อเครื่องเล่นเพลง"
                onClick={() => setMusicOpen(false)}
                className="wk-floating-close"
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
              <MiniPlayer />
            </div>
          )}
        </div>
      )}
    </>
  );
}
