import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { apiMusicLibrary } from "@/lib/api";
import { useMusic } from "@/lib/music";
import { gpsBridge } from "@/lib/gps-bridge";
import { appCommandBus, startAppCommandBridge } from "@/lib/app-command-bus";
import { featureFlags } from "@/lib/feature-flags";

type Props = { enabled?: boolean };

export function AppCommandRuntime({ enabled = true }: Props) {
  const navigate = useNavigate();
  const music = useMusic();

  useEffect(() => {
    if (!enabled) return;

    const stopEvents = startAppCommandBridge();
    const stopPointerUnlock = () => {
      if (featureFlags.musicAutomation) void music.unlock();
    };

    if (featureFlags.musicAutomation) {
      document.addEventListener("pointerdown", stopPointerUnlock, { once: true, passive: true });
      document.addEventListener("touchstart", stopPointerUnlock, { once: true, passive: true });
    }

    const playFromLibrary = async () => {
      if (!featureFlags.musicAutomation) return;
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
        // Music is optional; command processing must continue.
      }
    };

    const unsubscribe = appCommandBus.subscribe(async (command) => {
      switch (command.type) {
        case "PLAY_MUSIC":
          await playFromLibrary();
          return;
        case "PAUSE_MUSIC":
          if (featureFlags.musicAutomation && music.isPlaying) music.toggle();
          return;
        case "STOP_MUSIC":
          if (featureFlags.musicAutomation) music.stop();
          return;
        case "NEXT_MUSIC":
          if (featureFlags.musicAutomation) music.next();
          return;
        case "PREVIOUS_MUSIC":
          if (featureFlags.musicAutomation) music.prev();
          return;
        case "START_GPS":
          await gpsBridge.start();
          await playFromLibrary();
          return;
        case "STOP_GPS":
          await gpsBridge.stop();
          return;
        case "OPEN_ROUTE":
          if (command.route.startsWith("/") && command.route.length < 80) await navigate({ to: command.route as any });
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
          window.dispatchEvent(new CustomEvent("wk:navigation-milestone", { detail: { milestoneKm: Math.max(0.25, Number(command.milestoneKm) || 1) } }));
          return;
        case "NAVIGATE_TO":
          // VoiceControlAdvanced already starts GPS and emits wk:navigate-to.
          // Do not re-emit or navigate here; doing so would duplicate the workflow.
          if (!gpsBridge.isReady()) await gpsBridge.start();
          return;
        case "NONE":
          return;
      }
    });

    return () => {
      unsubscribe();
      stopEvents();
      if (featureFlags.musicAutomation) {
        document.removeEventListener("pointerdown", stopPointerUnlock);
        document.removeEventListener("touchstart", stopPointerUnlock);
      }
    };
  }, [enabled, music, navigate]);

  return null;
}
