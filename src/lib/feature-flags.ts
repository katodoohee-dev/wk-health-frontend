type Env = Record<string, string | undefined>;

const env = import.meta.env as Env;

function envBool(name: string, fallback: boolean) {
  const raw = env[name];
  if (raw == null) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

/**
 * Safe rollout switches. New integration remains opt-in until its build and runtime checks pass.
 * Set the VITE_WK_* variable to "true" only after the corresponding stage is verified.
 */
export const featureFlags = Object.freeze({
  navigationV2: envBool("VITE_WK_NAVIGATION_V2", true),
  voiceRuntime: envBool("VITE_WK_VOICE_RUNTIME", false),
  musicAutomation: envBool("VITE_WK_MUSIC_AUTOMATION", false),
  centralController: envBool("VITE_WK_CENTRAL_CONTROLLER", false),
});
