import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { featureFlags } from "@/lib/feature-flags";

type NavigationComponent = ComponentType;
type NavDetail = { destination?: string; milestoneKm?: number; announceTurns?: boolean };

/** Client-only navigation loader. Buffers the first destination so a voice command cannot race the dynamic import. */
export function NavigationOverlayLoader() {
  const [ClientComponent, setClientComponent] = useState<NavigationComponent | null>(null);
  const pendingRef = useRef<NavDetail | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    const remember = (event: Event) => {
      const detail = (event as CustomEvent<NavDetail>).detail;
      if (!detail?.destination) return;
      if (!readyRef.current) pendingRef.current = detail;
    };
    window.addEventListener("wk:navigate-to", remember);

    let alive = true;
    const load = featureFlags.navigationV2 ? import("./NavigationOverlayV2") : import("./NavigationOverlay");
    load
      .then((mod) => {
        const Component = mod.default ?? mod.NavigationOverlay;
        if (!alive || !Component) return;
        setClientComponent(() => Component);
        readyRef.current = true;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending?.destination) {
          window.dispatchEvent(new CustomEvent("wk:navigate-to", { detail: pending }));
        }
        window.removeEventListener("wk:navigate-to", remember);
      })
      .catch(() => {
        // Navigation is optional; never let a navigation-module failure crash the app shell.
        window.removeEventListener("wk:navigate-to", remember);
      });

    return () => {
      alive = false;
      window.removeEventListener("wk:navigate-to", remember);
    };
  }, []);

  return ClientComponent ? <ClientComponent /> : null;
}

export default NavigationOverlayLoader;
