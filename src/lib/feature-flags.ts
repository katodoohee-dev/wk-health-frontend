type Env = Record<string, string | undefined>;

const env = import.meta.env as Env;

function envBool(name: string, fallback: boolean) {
  const raw = env[name];
  if (raw == null) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

/**
 * Rollout switches. Each subsystem can still be disabled independently with VITE_WK_* variables.
 */
export const featureFlags = Object.freeze({
  navigationV2: envBool("VITE_WK_NAVIGATION_V2", true),
  voiceRuntime: envBool("VITE_WK_VOICE_RUNTIME", true),
  musicAutomation: envBool("VITE_WK_MUSIC_AUTOMATION", true),
  centralController: envBool("VITE_WK_CENTRAL_CONTROLLER", true),
  /**
   * Location sharing is available in the app; the user consent itself remains OFF by default.
   * Set VITE_WK_FRIEND_LOCATION_SHARING=false as an emergency kill switch.
   */
  locationSharing: envBool("VITE_WK_FRIEND_LOCATION_SHARING", true),
});
