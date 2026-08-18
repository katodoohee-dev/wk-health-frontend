import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { apiMusicLibrary } from "@/lib/api";
import { useMusic } from "@/lib/music";
import { gpsBridge } from "@/lib/gps-bridge";
import { appCommandBus, startAppCommandBridge } from "@/lib/app-command-bus";

type Props = { enabled?: boolean };

export function AppCommandRuntime({ enabled = true }: Props) {
  const navigate = useNavigate();
  const music = useMusic();

  useEffect(() => {
    if (!enabled) return;

    const stopEvents = startAppCommandBridge();
    const stopPointerUnlock = () => {
      void music.unlock();
    };

    // User gesture unlock: voice can be processed asynchronously, while the audio element is
    // prepared during the actual microphone/button gesture. This greatly improves mobile autoplay.
    document.addEventListener("pointerdown", stopPointerUnlock, { once: true, passive: true });
    document.addEventListener("touchstart", stopPointerUnlock, { once: true, passive: true });

    const unsubscribe = appCommandBus.subscribe(async (command) => {
      switch (command.type) {
        case "PLAY_MUSIC": {
          await music.unlock();
          if (music.current) {
            if (!music.isPlaying) music.toggle();
            return;
          }
          try {
            const tracks = await apiMusicLibrary();
            const audioTrack = tracks.find((t) => t.type === "audio") ?? tracks[0];
            if (audioTrack) music.play(audioTrack, tracks);
          } catch {
            // Keep the voice loop alive when the music library is unavailable.
          }
          return;
        }
        case "PAUSE_MUSIC":
          if (music.isPlaying) music.toggle();
          return;
        case "STOP_MUSIC":
          music.stop();
          return;
        case "NEXT_MUSIC":
          music.next();
          return;
        case "PREVIOUS_MUSIC":
          music.prev();
          return;
        case "START_GPS":
          await gpsBridge.start();
          await music.unlock();
          try {
            const tracks = await apiMusicLibrary();
            const audioTrack = tracks.find((t) => t.type === "audio") ?? tracks[0];
            if (audioTrack && !music.isPlaying) music.play(audioTrack, tracks);
          } catch {
            // Music is optional; GPS must still start.
          }
          if (window.location.pathname !== "/pedometer") {
            await navigate({ to: "/pedometer" });
          }
          return;
        case "STOP_GPS":
          await gpsBridge.stop();
          return;
        case "OPEN_ROUTE":
          if (command.route.startsWith("/") && command.route.length < 80) {
            await navigate({ to: command.route as any });
          }
          return;
        case "SHOW_STEPS":
          await navigate({ to: "/pedometer" });
          return;
        case "SHOW_CALORIES":
          await navigate({ to: "/stats" });
          return;
        case "SAVE_MEAL":
          await navigate({ to: "/scan" });
          return;
        case "OPEN_PROFILE":
          await navigate({ to: "/profile" });
          return;
        case "SET_MILESTONE":
          window.dispatchEvent(new CustomEvent("wk:navigation-milestone", {
            detail: { milestoneKm: Math.max(0.25, Number(command.milestoneKm) || 1) },
          }));
          return;
        case "NAVIGATE_TO":
          // The existing navigation overlay already consumes wk:navigate-to. The runtime
          // only guarantees that GPS/pedometer are ready; it does not re-emit the same event,
          // avoiding recursive command loops.
          await gpsBridge.start();
          await navigate({ to: "/pedometer" });
          return;
        case "NONE":
          return;
      }
    });

    return () => {
      unsubscribe();
      stopEvents();
      document.removeEventListener("pointerdown", stopPointerUnlock);
      document.removeEventListener("touchstart", stopPointerUnlock);
    };
  }, [enabled, music, navigate]);

  return null;
}
