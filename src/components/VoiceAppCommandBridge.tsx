import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { apiMusicLibrary } from "@/lib/api";
import { useMusic } from "@/lib/music";

/**
 * Central, whitelisted bridge from voice events to real WK Health UI actions.
 * It intentionally does not execute arbitrary JS/DOM commands.
 */
export function VoiceAppCommandBridge() {
  const navigate = useNavigate();
  const music = useMusic();

  useEffect(() => {
    const onMusic = async (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (!action) return;

      if (action === "play") {
        if (music.current) {
          if (!music.isPlaying) music.toggle();
          return;
        }
        try {
          const tracks = await apiMusicLibrary();
          if (tracks[0]) music.play(tracks[0], tracks);
        } catch {
          // Keep voice mode alive; the UI can still report that no music is available.
        }
        return;
      }

      if (action === "pause") {
        if (music.isPlaying) music.toggle();
        return;
      }
      if (action === "stop") {
        music.stop();
        return;
      }
      if (action === "next") {
        music.next();
        return;
      }
      if (action === "prev") {
        music.prev();
      }
    };

    window.addEventListener("wk:music", onMusic);
    return () => window.removeEventListener("wk:music", onMusic);
  }, [music]);

  useEffect(() => {
    const onVoiceAction = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (!action) return;

      const routes: Record<string, string> = {
        SHOW_STEPS: "/pedometer",
        SHOW_CALORIES: "/stats",
        SAVE_MEAL: "/scan",
        OPEN_MUSIC: "/music",
        OPEN_DIARY: "/diary",
        OPEN_STATS: "/stats",
        OPEN_SCAN: "/scan",
        OPEN_BARCODE: "/barcode",
        OPEN_PEDOMETER: "/pedometer",
        OPEN_ASSISTANT: "/assistant",
        OPEN_PROFILE: "/profile",
      };
      const route = routes[action];
      if (route) void navigate({ to: route as any });
    };

    window.addEventListener("wk:voice-action", onVoiceAction);
    return () => window.removeEventListener("wk:voice-action", onVoiceAction);
  }, [navigate]);

  return null;
}
