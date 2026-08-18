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

export const appCommandBus = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async dispatch(command: AppCommand) {
    for (const listener of Array.from(listeners)) {
      await listener(command);
    }
  },
};

// Compatibility bridge: existing voice code already emits these events.
// Keeping this translation layer lets us centralize execution without forcing a risky rewrite
// of the speech-recognition component.
export function startAppCommandBridge() {
  const handlers: Array<[string, EventListener]> = [
    ["wk:music", (event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      const map: Record<string, AppCommand["type"]> = {
        play: "PLAY_MUSIC",
        pause: "PAUSE_MUSIC",
        stop: "STOP_MUSIC",
        next: "NEXT_MUSIC",
        prev: "PREVIOUS_MUSIC",
      };
      const type = action ? map[action] : undefined;
      if (type) void appCommandBus.dispatch({ type } as AppCommand);
    }],
    ["wk:navigate-to", (event) => {
      const d = (event as CustomEvent<{ destination?: string; milestoneKm?: number; announceTurns?: boolean }>).detail;
      if (!d?.destination) return;
      void appCommandBus.dispatch({
        type: "NAVIGATE_TO",
        destination: d.destination,
        milestoneKm: d.milestoneKm,
        announceTurns: d.announceTurns,
      });
    }],
    ["wk:navigation-milestone", (event) => {
      const milestoneKm = Number((event as CustomEvent<{ milestoneKm?: number }>).detail?.milestoneKm);
      if (Number.isFinite(milestoneKm)) void appCommandBus.dispatch({ type: "SET_MILESTONE", milestoneKm });
    }],
    ["wk:voice-action", (event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      const map: Record<string, AppCommand["type"]> = {
        SHOW_STEPS: "SHOW_STEPS",
        SHOW_CALORIES: "SHOW_CALORIES",
        SAVE_MEAL: "SAVE_MEAL",
        OPEN_PROFILE: "OPEN_PROFILE",
        OPEN_MUSIC: "OPEN_ROUTE",
        OPEN_DIARY: "OPEN_ROUTE",
        OPEN_STATS: "OPEN_ROUTE",
        OPEN_SCAN: "OPEN_ROUTE",
        OPEN_BARCODE: "OPEN_ROUTE",
        OPEN_PEDOMETER: "OPEN_ROUTE",
        OPEN_ASSISTANT: "OPEN_ROUTE",
      };
      if (action === "OPEN_MUSIC") void appCommandBus.dispatch({ type: "OPEN_ROUTE", route: "/music" });
      else if (action === "OPEN_DIARY") void appCommandBus.dispatch({ type: "OPEN_ROUTE", route: "/diary" });
      else if (action === "OPEN_STATS") void appCommandBus.dispatch({ type: "OPEN_ROUTE", route: "/stats" });
      else if (action === "OPEN_SCAN") void appCommandBus.dispatch({ type: "OPEN_ROUTE", route: "/scan" });
      else if (action === "OPEN_BARCODE") void appCommandBus.dispatch({ type: "OPEN_ROUTE", route: "/barcode" });
      else if (action === "OPEN_PEDOMETER") void appCommandBus.dispatch({ type: "OPEN_ROUTE", route: "/pedometer" });
      else if (action === "OPEN_ASSISTANT") void appCommandBus.dispatch({ type: "OPEN_ROUTE", route: "/assistant" });
      else if (action === "OPEN_PROFILE") void appCommandBus.dispatch({ type: "OPEN_PROFILE" });
      else {
        const type = action ? map[action] : undefined;
        if (type === "SHOW_STEPS" || type === "SHOW_CALORIES" || type === "SAVE_MEAL") void appCommandBus.dispatch({ type });
      }
    }],
  ];

  for (const [name, handler] of handlers) window.addEventListener(name, handler);
  return () => {
    for (const [name, handler] of handlers) window.removeEventListener(name, handler);
  };
}
