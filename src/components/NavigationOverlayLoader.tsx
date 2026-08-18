import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

type NavigationComponent = ComponentType;
type NavDetail = { destination?: string; milestoneKm?: number; announceTurns?: boolean };

/** Client-only navigation loader. Buffers a destination until the map component has mounted. */
export function NavigationOverlayLoader() {
  const [ClientComponent, setClientComponent] = useState<NavigationComponent | null>(null);
  const pendingRef = useRef<NavDetail | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    const remember = (event: Event) => {
      const detail = (event as CustomEvent<NavDetail>).detail;
      if (detail?.destination && !readyRef.current) pendingRef.current = detail;
    };
    window.addEventListener("wk:navigate-to", remember);
    let alive = true;
    import("./NavigationOverlayV3")
      .then((mod) => {
        const Component = mod.default;
        if (!alive || !Component) return;
        setClientComponent(() => Component);
        readyRef.current = true;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending?.destination) window.setTimeout(() => window.dispatchEvent(new CustomEvent("wk:navigate-to", { detail: pending })), 0);
        window.removeEventListener("wk:navigate-to", remember);
      })
      .catch(() => window.removeEventListener("wk:navigate-to", remember));
    return () => { alive = false; window.removeEventListener("wk:navigate-to", remember); };
  }, []);

  return ClientComponent ? <ClientComponent /> : null;
}

export default NavigationOverlayLoader;
