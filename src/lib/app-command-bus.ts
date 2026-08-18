export type AppCommand =
  | { type: "PLAY_MUSIC" }
  | { type: "PAUSE_MUSIC" }
  | { type: "STOP_MUSIC" }
  | { type: "NEXT_MUSIC" }
  | { type: "PREVIOUS_MUSIC" }
  | { type: "START_GPS"; activity?: "walk" | "run" | "cycle" }
  | { type: "STOP_GPS" }
  | { type: "OPEN_ROUTE"; route: string }
  | { type: "NAVIGATE_TO"; destination: string; milestoneKm?: number; announceTurns?: boolean }
  | { type: "SET_MILESTONE"; milestoneKm: number }
  | { type: "SHOW_STEPS" }
  | { type: "SHOW_CALORIES" }
  | { type: "SAVE_MEAL" }
  | { type: "OPEN_PROFILE" }
  | { type: "NONE" };

type Listener = (command: AppCommand) => void | Promise<void>;
const listeners = new Set<Listener>();

function reportCommandError(command: AppCommand, error: unknown) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wk:command-error", { detail: { command, error } }));
}

export const appCommandBus = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async dispatch(command: AppCommand) {
    for (const listener of Array.from(listeners)) {
      try {
        await listener(command);
      } catch (error) {
        // A failing optional subsystem must never abort other commands or the voice loop.
        reportCommandError(command, error);
      }
    }
  },
};

// Compatibility bridge: existing voice code already emits these events.
export function startAppCommandBridge() {
  const dispatch = (command: AppCommand) => {
    void appCommandBus.dispatch(command);
  };
  const handlers: Array<[string, EventListener]> = [
    ["wk:music", (event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      const map: Record<string, AppCommand["type"]> = { play: "PLAY_MUSIC", pause: "PAUSE_MUSIC", stop: "STOP_MUSIC", next: "NEXT_MUSIC", prev: "PREVIOUS_MUSIC" };
      const type = action ? map[action] : undefined;
      if (type) dispatch({ type } as AppCommand);
    }],
    ["wk:navigate-to", (event) => {
      const d = (event as CustomEvent<{ destination?: string; milestoneKm?: number; announceTurns?: boolean }>).detail;
      if (d?.destination) dispatch({ type: "NAVIGATE_TO", destination: d.destination, milestoneKm: d.milestoneKm, announceTurns: d.announceTurns });
    }],
    ["wk:navigation-milestone", (event) => {
      const milestoneKm = Number((event as CustomEvent<{ milestoneKm?: number }>).detail?.milestoneKm);
      if (Number.isFinite(milestoneKm)) dispatch({ type: "SET_MILESTONE", milestoneKm });
    }],
    ["wk:voice-action", (event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      const routes: Record<string, string> = { OPEN_MUSIC: "/music", OPEN_DIARY: "/diary", OPEN_STATS: "/stats", OPEN_SCAN: "/scan", OPEN_BARCODE: "/barcode", OPEN_PEDOMETER: "/pedometer", OPEN_ASSISTANT: "/assistant" };
      if (action === "OPEN_PROFILE") dispatch({ type: "OPEN_PROFILE" });
      else if (routes[action || ""]) dispatch({ type: "OPEN_ROUTE", route: routes[action!] });
      else if (action === "SHOW_STEPS" || action === "SHOW_CALORIES" || action === "SAVE_MEAL") dispatch({ type: action });
    }],
  ];

  for (const [name, handler] of handlers) window.addEventListener(name, handler);
  return () => {
    for (const [name, handler] of handlers) window.removeEventListener(name, handler);
  };
}
