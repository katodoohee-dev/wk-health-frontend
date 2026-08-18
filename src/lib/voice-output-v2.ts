type SpeakOptions = { source?: string; priority?: number; interrupt?: boolean; onStart?: () => void; onEnd?: () => void };
type ArbiterState = { token: number; source: string; priority: number };
function getState(): ArbiterState {
  if (typeof window === "undefined") return { token: 0, source: "", priority: 0 };
  const w = window as Window & { __wkVoiceOutputV2?: ArbiterState };
  if (!w.__wkVoiceOutputV2) w.__wkVoiceOutputV2 = { token: 0, source: "", priority: 0 };
  return w.__wkVoiceOutputV2;
}
export function stopVoiceOutputV2() { if (typeof window !== "undefined" && "speechSynthesis" in window) { const s=getState(); s.token+=1; s.source=""; s.priority=0; window.speechSynthesis.cancel(); } }
export function speakThaiV2(text: string, options: SpeakOptions = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
  const s=getState(); const priority=options.priority??0;
  if (s.source && s.priority>priority && !options.interrupt) return;
  s.token+=1; const token=s.token; s.source=options.source??"wk"; s.priority=priority; window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text.trim()); u.lang="th-TH"; u.rate=0.95; const v=window.speechSynthesis.getVoices().find(x=>x.lang.toLowerCase().startsWith("th")); if(v) u.voice=v; options.onStart?.();
  const finish=()=>{ if(s.token!==token) return; s.source=""; s.priority=0; options.onEnd?.(); }; u.onend=finish; u.onerror=finish; window.speechSynthesis.speak(u);
}
