import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { featureFlags } from "@/lib/feature-flags";

type NavigationComponent = ComponentType;

/** Client-only navigation loader. Old implementation remains available for rollback. */
export function NavigationOverlayLoader() {
  const [ClientComponent, setClientComponent] = useState<NavigationComponent | null>(null);

  useEffect(() => {
    let alive = true;
    const path = featureFlags.navigationV2 ? "./NavigationOverlayV2" : "./NavigationOverlay";
    import(path)
      .then((mod) => {
        const Component = mod.default ?? mod.NavigationOverlay;
        if (alive && Component) setClientComponent(() => Component);
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
