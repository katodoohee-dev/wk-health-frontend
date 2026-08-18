import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { featureFlags } from "@/lib/feature-flags";

type RuntimeComponent = ComponentType<{ enabled?: boolean }>;

/** Client-only loader. A runtime module failure never bubbles into AppShell. */
export function AppCommandRuntimeLoader() {
  const [Runtime, setRuntime] = useState<RuntimeComponent | null>(null);

  useEffect(() => {
    if (!featureFlags.voiceRuntime) return;
    let alive = true;
    import("./AppCommandRuntime")
      .then((mod) => {
        if (alive && mod.AppCommandRuntime) setRuntime(() => mod.AppCommandRuntime);
      })
      .catch(() => {
        // Optional controller: keep the rest of the application alive if it cannot load.
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!featureFlags.voiceRuntime || !Runtime) return null;
  return <Runtime enabled />;
}

export default AppCommandRuntimeLoader;
