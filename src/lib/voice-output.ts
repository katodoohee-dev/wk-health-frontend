type SpeakOptions = {
  source?: string;
  priority?: number;
  interrupt?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
};

type SpeechJob = {
  text: string;
  options: SpeakOptions;
};

type ArbiterState = {
  speaking: boolean;
  current: SpeechJob | null;
  queue: SpeechJob[];
  voicesReady: boolean;
};

function getState(): ArbiterState {
  if (typeof window === "undefined") {
    return { speaking: false, current: null, queue: [], voicesReady: false };
  }
  const w = window as Window & { __wkVoiceOutput?: ArbiterState };
  if (!w.__wkVoiceOutput) {
    w.__wkVoiceOutput = { speaking: false, current: null, queue: [], voicesReady: false };
  }
  return w.__wkVoiceOutput;
}

function rank(options: SpeakOptions) {
  return Number(options.priority ?? 0);
}

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function playNext() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const state = getState();
  if (state.speaking) return;
  const next = state.queue.shift();
  if (!next) {
    state.current = null;
    return;
  }

  state.speaking = true;
  state.current = next;
  const utterance = new SpeechSynthesisUtterance(next.text);
  utterance.lang = "th-TH";
  utterance.rate = 0.95;

  const voices = window.speechSynthesis.getVoices();
  const thaiVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("th"));
  if (thaiVoice) utterance.voice = thaiVoice;

  next.options.onStart?.();

  const finish = () => {
    if (!state.speaking || state.current !== next) return;
    state.speaking = false;
    state.current = null;
    next.options.onEnd?.();
    queueMicrotask(playNext);
  };

  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);
}

export function stopVoiceOutput() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const state = getState();
  state.queue = [];
  state.current = null;
  state.speaking = false;
  window.speechSynthesis.cancel();
}

export function speakThai(text: string, options: SpeakOptions = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const normalized = normalize(text);
  if (!normalized) return;

  const state = getState();
  const job: SpeechJob = { text: normalized, options };
  const currentPriority = rank(state.current?.options ?? {});
  const nextPriority = rank(options);

  // Never speak the exact same message twice while it is active or queued.
  const duplicate =
    (state.current?.text === normalized) ||
    state.queue.some((queued) => queued.text === normalized && queued.options.source === options.source);
  if (duplicate) return;

  // Explicit interrupt is reserved for emergency/stop messages.
  if (options.interrupt && (!state.current || nextPriority >= currentPriority)) {
    state.queue = [];
    state.current = null;
    state.speaking = false;
    window.speechSynthesis.cancel();
  }

  // Keep higher-priority navigation/system speech ahead of normal assistant chatter.
  if (nextPriority >= 80) {
    const firstNormalIndex = state.queue.findIndex((queued) => rank(queued.options) < nextPriority);
    if (firstNormalIndex >= 0) state.queue.splice(firstNormalIndex, 0, job);
    else state.queue.push(job);
  } else {
    state.queue.push(job);
  }

  playNext();
}

export function installSpeechArbiter() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => undefined;
  // Prime the browser voice list without taking ownership of the global engine.
  const state = getState();
  if (!state.voicesReady) {
    state.voicesReady = true;
    window.speechSynthesis.getVoices();
  }
  return () => undefined;
}
