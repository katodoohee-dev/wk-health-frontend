import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Volume2, VolumeX, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import "./voice-control.css";

type Status = "idle" | "listening" | "processing" | "success" | "error";
type ExerciseResult = { activity: string; duration_min: number; mets: number; kcal: number };
type Props = { profileName: string | null | undefined; bodyWeightKg: number; onExercise: (result: ExerciseResult) => void; onStartGps: () => void; onStopGps: () => void; onOpenProfileModal: () => void };
type Action =
  | { action: "START_WALK" | "START_RUN" | "START_CYCLE" | "START_GPS" }
  | { action: "STOP_WALK" | "STOP_RUN" | "STOP_CYCLE" | "STOP_GPS" }
  | { action: "PLAY_MUSIC" | "PAUSE_MUSIC" | "STOP_MUSIC" | "NEXT_MUSIC" | "PREVIOUS_MUSIC" }
  | { action: "OPEN_MUSIC" | "OPEN_DIARY" | "OPEN_STATS" | "OPEN_SCAN" | "OPEN_BARCODE" | "OPEN_PEDOMETER" | "OPEN_ASSISTANT" | "OPEN_PROFILE" }
  | { action: "NAVIGATE_TO"; destination: string; milestone_km?: number; announce_turns?: boolean }
  | { action: "SET_MILESTONE"; milestone_km: number }
  | { action: "EXERCISE"; activity: string; duration_min: number; mets: number }
  | { action: "SHOW_CALORIES" | "SHOW_STEPS" | "SAVE_MEAL" | "NONE" };

const DEEPSEEK_ENDPOINT = "https://kasidathdeepseek.katodoohee.workers.dev";
const TTS_KEY = "wk_voice_tts_enabled";
const VOICE_MODE_KEY = "wk_voice_mode_enabled";
const ROUTES: Record<string, string> = { OPEN_MUSIC: "/music", OPEN_DIARY: "/diary", OPEN_STATS: "/stats", OPEN_SCAN: "/scan", OPEN_BARCODE: "/barcode", OPEN_PEDOMETER: "/pedometer", OPEN_ASSISTANT: "/assistant" };

function durationMin(text: string) {
  const normalized = text.replace(/สิบ/g, "10").replace(/หนึ่ง/g, "1").replace(/สอง/g, "2").replace(/สาม/g, "3").replace(/สี่/g, "4").replace(/ห้า/g, "5").replace(/หก/g, "6").replace(/เจ็ด/g, "7").replace(/แปด/g, "8").replace(/เก้า/g, "9");
  const h = normalized.match(/(\d+(?:\.\d+)?)\s*ชั่วโมง/); if (h) return Number(h[1]) * 60;
  const m = normalized.match(/(\d+(?:\.\d+)?)\s*นาที/); if (m) return Number(m[1]);
  return null;
}

function localActions(text: string): Action[] {
  const t = text.toLowerCase(); const out: Action[] = [];
  const mile = t.match(/ทุก\s*(\d+(?:\.\d+)?)\s*(กิโล|กม|กิโลเมตร)/i);
  const to = t.match(/(?:ไป|นำทาง|พาไป|พาฉันไป|พาเราไป|อยากไป)\s*(?:ที่|ยัง|หา|ทางไป)?\s*(.+?)(?:\s+ทุก\s*\d+(?:\.\d+)?\s*(?:กิโล|กม|กิโลเมตร))?$/i);
  if (to?.[1] && /(นำทาง|พาไป|ไปที่|ไปยัง|อยากไป|ทางไป)/i.test(t)) out.push({ action: "NAVIGATE_TO", destination: to[1].trim(), milestone_km: mile ? Number(mile[1]) : 1, announce_turns: true });
  if (/(หยุดนำทาง|ยกเลิกนำทาง|เลิกนำทาง)/i.test(t)) out.push({ action: "NONE" });
  if (/(เพลงถัดไป|เพลงต่อไป|ข้ามเพลง|เปลี่ยนเพลง)/i.test(t)) out.push({ action: "NEXT_MUSIC" });
  else if (/(เพลงก่อน|ย้อนเพลง)/i.test(t)) out.push({ action: "PREVIOUS_MUSIC" });
  else if (/(พักเพลง|หยุดชั่วคราว)/i.test(t)) out.push({ action: "PAUSE_MUSIC" });
  else if (/(หยุดเพลง|ปิดเพลง)/i.test(t)) out.push({ action: "STOP_MUSIC" });
  else if (/(เปิดเพลง|เล่นเพลง|ขอเพลง|หาเพลง)/i.test(t)) out.push({ action: "PLAY_MUSIC" });
  if (/(เปิด|ไป|เข้า).*(นับก้าว|pedometer)/i.test(t)) out.push({ action: "OPEN_PEDOMETER" });
  if (/(เริ่มเดิน|ออกไปเดิน|เดินกัน|เริ่มวิ่ง|ออกไปวิ่ง|เริ่มปั่น|เริ่มออกกำลังกาย|เริ่มบันทึกเส้นทาง)/i.test(t)) out.push({ action: /วิ่ง/.test(t) ? "START_RUN" : /ปั่น/.test(t) ? "START_CYCLE" : "START_WALK" });
  if (/(หยุดเดิน|หยุดวิ่ง|หยุดปั่น|หยุดบันทึกเส้นทาง|หยุดออกกำลังกาย|พอแล้ว)/i.test(t)) out.push({ action: "STOP_GPS" });
  if (/(กี่แคล|แคลอรี|แคลอรี่|พลังงานวันนี้)/i.test(t)) out.push({ action: "SHOW_CALORIES" });
  if (/(กี่ก้าว|จำนวนก้าว|เดินไปกี่ก้าว)/i.test(t)) out.push({ action: "SHOW_STEPS" });
  return out;
}

async function askIntent(text: string): Promise<Action[]> {
  const system = `คุณคือ intent router ภาษาไทยของ WK Health
ผู้ใช้พูดได้อิสระมาก ทุกสำนวน พูดอ้อม พูดยาว พูดผิดเล็กน้อยได้ ให้ตีความตามความหมาย
คืน JSON array เท่านั้น
ถ้าผู้ใช้ต้องการไปสถานที่ใด ให้ใช้ NAVIGATE_TO พร้อม destination ที่เป็นชื่อสถานที่/ที่อยู่ที่ค้นหาได้
ถ้าผู้ใช้บอก "ทุก 1 กิโล" หรือระยะอื่น ให้ใส่ milestone_km
ถ้าต้องการนำทาง ให้ announce_turns=true
Allowed actions:
START_WALK,START_RUN,START_CYCLE,START_GPS,STOP_WALK,STOP_RUN,STOP_CYCLE,STOP_GPS,
PLAY_MUSIC,PAUSE_MUSIC,STOP_MUSIC,NEXT_MUSIC,PREVIOUS_MUSIC,
OPEN_MUSIC,OPEN_DIARY,OPEN_STATS,OPEN_SCAN,OPEN_BARCODE,OPEN_PEDOMETER,OPEN_ASSISTANT,OPEN_PROFILE,
NAVIGATE_TO,SET_MILESTONE,EXERCISE,SHOW_CALORIES,SHOW_STEPS,SAVE_MEAL,NONE.`;
  const res = await fetch(DEEPSEEK_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: text }] }) });
  if (!res.ok) throw new Error("intent unavailable");
  const data = await res.json();
  const raw = String(data?.content ?? data?.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(raw); const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.filter((x: any) => x && typeof x.action === "string") as Action[];
}

async function askThaiAssistant(text: string) {
  const res = await fetch(DEEPSEEK_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "system", content: "คุณคือผู้ช่วย WK Health สื่อสารภาษาไทยอย่างเป็นธรรมชาติและกระชับเท่านั้น ห้ามตอบอังกฤษ และห้ามอ้างว่าทำสิ่งใดสำเร็จหากยังไม่ได้ทำจริง" }, { role: "user", content: text }] }) });
  if (!res.ok) throw new Error("assistant unavailable");
  const data = await res.json();
  return String(data?.content ?? data?.choices?.[0]?.message?.content ?? "รับทราบครับ").trim();
}

function thaiVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => /^th[-_]/i.test(v.lang)) || voices.find(v => v.lang.toLowerCase().startsWith("th"));
}

export function VoiceControlAdvanced({ profileName, bodyWeightKg, onExercise, onStartGps, onStopGps, onOpenProfileModal }: Props) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [tts, setTts] = useState(() => typeof window === "undefined" ? true : localStorage.getItem(TTS_KEY) !== "0");
  const [voiceMode, setVoiceMode] = useState(() => typeof window === "undefined" ? false : localStorage.getItem(VOICE_MODE_KEY) === "1");
  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(voiceMode); const ttsRef = useRef(tts); const speakingRef = useRef(false);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null); const executeRef = useRef<(text: string) => Promise<void>>(async () => undefined);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { ttsRef.current = tts; }, [tts]);
  const stopRecognition = useCallback(() => { if (restartRef.current) clearTimeout(restartRef.current); try { recognitionRef.current?.stop?.(); } catch {} recognitionRef.current = null; }, []);
  const speak = useCallback((message: string) => {
    setReply(message);
    if (!ttsRef.current || !("speechSynthesis" in window)) { speakingRef.current = false; if (voiceModeRef.current) restartRef.current = setTimeout(startRecognitionSafe, 120); return; }
    speakingRef.current = true; stopRecognition(); window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(message); u.lang = "th-TH"; u.rate = 0.95; const v = thaiVoice(); if (v) u.voice = v;
    u.onend = () => { speakingRef.current = false; if (voiceModeRef.current) restartRef.current = setTimeout(startRecognitionSafe, 150); };
    u.onerror = () => { speakingRef.current = false; if (voiceModeRef.current) restartRef.current = setTimeout(startRecognitionSafe, 150); };
    window.speechSynthesis.speak(u);
  }, [stopRecognition]);
  const runActions = useCallback(async (actions: Action[], original: string) => {
    let completed = 0;
    for (const a of actions) {
      if (a.action === "NAVIGATE_TO") {
        await navigate({ to: "/pedometer" });
        onStartGps();
        window.dispatchEvent(new CustomEvent("wk:navigate-to", { detail: { destination: a.destination, milestoneKm: a.milestone_km ?? 1, announceTurns: a.announce_turns !== false } }));
        completed++; continue;
      }
      if (a.action === "SET_MILESTONE") { window.dispatchEvent(new CustomEvent("wk:navigation-milestone", { detail: { milestoneKm: Math.max(0.25, Number(a.milestone_km) || 1) } })); completed++; continue; }
      if (a.action === "START_WALK" || a.action === "START_RUN" || a.action === "START_CYCLE" || a.action === "START_GPS") { onStartGps(); completed++; continue; }
      if (a.action === "STOP_WALK" || a.action === "STOP_RUN" || a.action === "STOP_CYCLE" || a.action === "STOP_GPS") { onStopGps(); completed++; continue; }
      if (a.action === "OPEN_PROFILE") { onOpenProfileModal(); completed++; continue; }
      if (a.action === "EXERCISE") { const mins = Math.max(1, Number(a.duration_min) || durationMin(original) || 20); const mets = Math.max(0.5, Number(a.mets) || 3.5); onExercise({ activity: a.activity || "ออกกำลังกาย", duration_min: mins, mets, kcal: Math.round(mets * bodyWeightKg * mins / 60) }); completed++; continue; }
      if (["PLAY_MUSIC", "PAUSE_MUSIC", "STOP_MUSIC", "NEXT_MUSIC", "PREVIOUS_MUSIC"].includes(a.action)) { const map: Record<string,string> = { PLAY_MUSIC:"play",PAUSE_MUSIC:"pause",STOP_MUSIC:"stop",NEXT_MUSIC:"next",PREVIOUS_MUSIC:"prev" }; window.dispatchEvent(new CustomEvent("wk:music", { detail: { action: map[a.action] } })); completed++; continue; }
      const route = ROUTES[a.action]; if (route) { await navigate({ to: route as any }); completed++; continue; }
      if (["SHOW_CALORIES","SHOW_STEPS","SAVE_MEAL"].includes(a.action)) { window.dispatchEvent(new CustomEvent("wk:voice-action", { detail: a })); completed++; continue; }
    }
    if (!completed || actions.every(a => a.action === "NONE")) { try { setStatus("success"); speak(await askThaiAssistant(original)); } catch { setStatus("error"); speak("ตอนนี้เชื่อมต่อผู้ช่วยไม่ได้ครับ ลองใหม่อีกครั้ง"); } return; }
    const labels: Record<string,string> = { NAVIGATE_TO:"ตั้งเส้นทางแล้ว",START_WALK:"เริ่มเดิน",START_RUN:"เริ่มวิ่ง",START_CYCLE:"เริ่มปั่น",STOP_GPS:"หยุดติดตาม",PLAY_MUSIC:"เปิดเพลง",PAUSE_MUSIC:"พักเพลง",STOP_MUSIC:"ปิดเพลง",NEXT_MUSIC:"เพลงถัดไป",PREVIOUS_MUSIC:"เพลงก่อนหน้า",EXERCISE:"บันทึกการออกกำลัง",SHOW_CALORIES:"ดูแคลอรี",SHOW_STEPS:"ดูก้าว",SAVE_MEAL:"บันทึกเมนู" };
    setStatus("success"); speak(actions.map(a => labels[a.action]).filter(Boolean).join(" และ ") || "รับทราบครับ");
  }, [bodyWeightKg, navigate, onExercise, onOpenProfileModal, onStartGps, onStopGps, speak]);
  const execute = useCallback(async (value: string) => { const v = value.trim(); if (!v) return; setText(v); setStatus("processing"); try { let actions = localActions(v); try { const ai = await askIntent(v); if (ai.some(a => a.action !== "NONE")) actions = ai; } catch {} await runActions(actions.length ? actions : [{ action: "NONE" }], v); } catch { setStatus("error"); speak("ขอโทษครับ ระบบขัดข้องชั่วคราว ลองพูดใหม่อีกครั้งครับ"); } }, [runActions, speak]);
  useEffect(() => { executeRef.current = execute; }, [execute]);
  const startRecognitionSafe = useCallback(() => {
    if (!voiceModeRef.current || speakingRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus("error"); setReply("เบราว์เซอร์นี้ไม่รองรับระบบเสียงครับ"); return; }
    stopRecognition(); const r = new SR(); r.lang = "th-TH"; r.continuous = false; r.interimResults = true; r.maxAlternatives = 5;
    r.onstart = () => setStatus("listening");
    r.onresult = (e: any) => { let finalText = ""; let interim = ""; for (let i=e.resultIndex;i<e.results.length;i++){ const s=String(e.results[i][0]?.transcript||"").trim(); if(e.results[i].isFinal) finalText += `${s} `; else interim += s; } setText(finalText.trim()||interim.trim()); if(finalText.trim()) void executeRef.current(finalText.trim()); };
    r.onerror = (e: any) => { if(!voiceModeRef.current) return; if(e?.error === "not-allowed" || e?.error === "permission-denied"){ setStatus("error"); setReply("ต้องอนุญาตไมโครโฟนก่อนครับ"); setVoiceMode(false); localStorage.setItem(VOICE_MODE_KEY,"0"); return; } if(e?.error !== "aborted" && !speakingRef.current){ setStatus("error"); setReply("ไม่ได้ยินเสียงครับ ลองพูดใหม่ได้เลย"); restartRef.current=setTimeout(startRecognitionSafe,500);} };
    r.onend = () => { recognitionRef.current=null; if(voiceModeRef.current && !speakingRef.current) restartRef.current=setTimeout(startRecognitionSafe,250); };
    recognitionRef.current=r; try { r.start(); } catch { recognitionRef.current=null; restartRef.current=setTimeout(startRecognitionSafe,400); }
  }, [stopRecognition]);
  const startMode = useCallback(() => { setVoiceMode(true); voiceModeRef.current=true; localStorage.setItem(VOICE_MODE_KEY,"1"); setReply("พร้อมฟังครับ พูดภาษาไทยได้ตามธรรมชาติเลย"); startRecognitionSafe(); }, [startRecognitionSafe]);
  const stopMode = useCallback(() => { setVoiceMode(false); voiceModeRef.current=false; localStorage.setItem(VOICE_MODE_KEY,"0"); speakingRef.current=false; stopRecognition(); if("speechSynthesis" in window) window.speechSynthesis.cancel(); setStatus("idle"); setReply("ปิดระบบเสียงแล้วครับ"); }, [stopRecognition]);
  const toggleTts = useCallback(() => { const next=!ttsRef.current; ttsRef.current=next; setTts(next); localStorage.setItem(TTS_KEY,next?"1":"0"); if(!next && "speechSynthesis" in window){window.speechSynthesis.cancel(); speakingRef.current=false; if(voiceModeRef.current) restartRef.current=setTimeout(startRecognitionSafe,120);} }, [startRecognitionSafe]);
  useEffect(() => { if(!("speechSynthesis" in window)) return; window.speechSynthesis.onvoiceschanged=()=>void thaiVoice(); return ()=>{window.speechSynthesis.onvoiceschanged=null;}; }, []);
  useEffect(() => () => { stopRecognition(); if("speechSynthesis" in window) window.speechSynthesis.cancel(); }, [stopRecognition]);
  const expanded = voiceMode || status !== "idle";
  return <div className="vc-fixed-wrap"><div className="vc-bar glass" style={{height:expanded?172:60}}><div className="vc-row"><button type="button" className={`vc-mic-btn ${voiceMode&&status==="listening"?"vc-breathe":""}`} onClick={()=>voiceMode?stopMode():startMode()} aria-label={voiceMode?"ปิดระบบเสียง":"เปิดระบบเสียงภาษาไทย"}>{status==="processing"?<Loader2 className="vc-icon vc-spin"/>:voiceMode?<X className="vc-icon"/>:<Mic className="vc-icon"/>}{voiceMode&&status==="listening"&&<span className="vc-ripple"/>}</button><div className="vc-status-text"><p>{status==="listening"?"กำลังฟังภาษาไทย…":status==="processing"?"กำลังวิเคราะห์ความหมาย…":status==="error"?(reply||"เกิดข้อผิดพลาด"):reply||"กดไมค์เพื่อเริ่มคุยภาษาไทย"}</p><p className="vc-subtext">{voiceMode?"โหมดสนทนาเรียลไทม์ • พูดต่อได้หลัง AI ตอบ":profileName?`WK • ${profileName}`:"WK HEALTH • VOICE"}</p></div><button onClick={toggleTts} className="press grid size-9 place-items-center rounded-xl" aria-label={tts?"ปิดเสียง AI":"เปิดเสียง AI"}>{tts?<Volume2 className="size-4"/>:<VolumeX className="size-4"/>}</button></div>{expanded&&<div className="vc-body vc-rise-in">{status==="listening"&&<div><div className="vc-waveform"><span className="vc-waveform-bar" style={{height:"55%"}}/><span className="vc-waveform-bar" style={{height:"90%"}}/><span className="vc-waveform-bar" style={{height:"45%"}}/><span className="vc-waveform-bar" style={{height:"75%"}}/><span className="vc-waveform-bar" style={{height:"60%"}}/></div><div className="vc-transcript-box"><p>{text||"พูดได้ตามธรรมชาติ เช่น ‘พาไปสวน...ทุก 1 กิโล’"}<span className="vc-caret"/></p></div></div>}{status==="processing"&&<div className="vc-processing"><Loader2 className="vc-icon-lg vc-spin vc-mint"/><p>กำลังเข้าใจภาษาไทยและจัดเส้นทาง…</p></div>}{status==="success"&&<div className="vc-result-card"><div className="vc-result-head"><div className="vc-result-icon"><Check className="vc-icon"/></div><div><p className="vc-result-label">พร้อมคุยต่อ</p><p className="vc-result-title">{reply||"ดำเนินการเรียบร้อยแล้ว"}</p></div></div></div>}{status==="error"&&<div className="vc-error-box"><p>{reply||"ลองพูดใหม่อีกครั้งครับ"}</p></div>}</div>}</div></div>;
}

export default VoiceControlAdvanced;
