type SpeakOptions = { source?: string; priority?: number; interrupt?: boolean; onStart?: () => void; onEnd?: () => void };

type ArbiterState = { token: number; source: string; priority: number };

function getState(): ArbiterState {
  if (typeof window === "undefined") return { token: 0, source: "", priority: 0 };
  const w = window as Window & { __wkVoiceOutput?: ArbiterState };
  if (!w.__wkVoiceOutput) w.__wkVoiceOutput = { token: 0, source: "", priority: 0 };
  return w.__wkVoiceOutput;
}

export function stopVoiceOutput() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const state = getState();
  state.token += 1;
  state.source = "";
  state.priority = 0;
  window.speechSynthesis.cancel();
}

export function speakThai(text: string, options: SpeakOptions = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
  const state = getState();
  const priority = options.priority ?? 0;
  if (state.source && state.priority > priority && !options.interrupt) return;
  state.token += 1;
  const token = state.token;
  state.source = options.source ?? "wk";
  state.priority = priority;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = "th-TH";
  utterance.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("th"));
  if (voice) utterance.voice = voice;
  options.onStart?.();
  const finish = () => {
    if (state.token !== token) return;
    state.source = "";
    state.priority = 0;
    options.onEnd?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);
}

export function installSpeechArbiter() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => undefined;
  const w = window as Window & { __wkVoiceArbiterInstalled?: boolean };
  if (w.__wkVoiceArbiterInstalled) return () => undefined;
  w.__wkVoiceArbiterInstalled = true;
  return () => undefined;
}
