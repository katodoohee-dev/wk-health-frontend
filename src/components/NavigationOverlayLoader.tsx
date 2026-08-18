import { useEffect, useState } from "react";
import type { ComponentType } from "react";

type NavigationComponent = ComponentType;

export function NavigationOverlayLoader() {
  const [ClientComponent, setClientComponent] = useState<NavigationComponent | null>(null);

  useEffect(() => {
    let alive = true;
    import("./NavigationOverlay")
      .then((mod) => {
        if (alive && mod.NavigationOverlay) setClientComponent(() => mod.NavigationOverlay);
      })
      .catch(() => {
        // Navigation is optional; never let a navigation-module failure crash the app shell.
      });
    return () => {
      alive = false;
    };
  }, []);

  return ClientComponent ? <ClientComponent /> : null;
}

export default NavigationOverlayLoader;
