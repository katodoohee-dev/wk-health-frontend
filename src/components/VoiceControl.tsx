import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX, Loader2, Check, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { apiAssistantChat } from "@/lib/api";
import "./voice-control.css";

type Status = "idle" | "listening" | "processing" | "success" | "error";
type ExerciseResult = { activity: string; duration_min: number; mets: number; kcal: number };
type VoiceControlProps = {
  profileName: string | null | undefined;
  bodyWeightKg: number;
  onExercise: (result: ExerciseResult) => void;
  onStartGps: () => void;
  onStopGps: () => void;
  onOpenProfileModal: () => void;
};

type VoiceAction =
  | { action: "START_WALK" | "START_RUN" | "START_CYCLE" | "START_GPS" }
  | { action: "STOP_WALK" | "STOP_RUN" | "STOP_CYCLE" | "STOP_GPS" }
  | { action: "PLAY_MUSIC" | "PAUSE_MUSIC" | "STOP_MUSIC" | "NEXT_MUSIC" | "PREVIOUS_MUSIC" }
  | { action: "OPEN_MUSIC" | "OPEN_DIARY" | "OPEN_STATS" | "OPEN_SCAN" | "OPEN_BARCODE" | "OPEN_PEDOMETER" | "OPEN_ASSISTANT" | "OPEN_PROFILE" }
  | { action: "EXERCISE"; activity: string; duration_min: number; mets: number }
  | { action: "SHOW_CALORIES" | "SHOW_STEPS" | "SAVE_MEAL" | "NONE" };

const DEEPSEEK_ENDPOINT = "https://kasidathdeepseek.katodoohee.workers.dev";
const TTS_KEY = "wk_voice_tts_enabled";
const ROUTES: Record<string, string> = {
  OPEN_MUSIC: "/music", OPEN_DIARY: "/diary", OPEN_STATS: "/stats", OPEN_SCAN: "/scan",
  OPEN_BARCODE: "/barcode", OPEN_PEDOMETER: "/pedometer", OPEN_ASSISTANT: "/assistant",
};

const LOCAL_METS = [
  { words: ["วิ่ง", "จ๊อกกิ้ง"], activity: "วิ่ง", mets: 8 },
  { words: ["เดิน", "เดินเล่น", "เดินออกกำลัง"], activity: "เดิน", mets: 3.5 },
  { words: ["ปั่นจักรยาน", "จักรยาน", "ปั่น"], activity: "ปั่นจักรยาน", mets: 6 },
  { words: ["ว่ายน้ำ", "ว่ายน้ํา"], activity: "ว่ายน้ำ", mets: 7 },
  { words: ["โยคะ"], activity: "โยคะ", mets: 2.5 },
  { words: ["เวท", "ยกน้ำหนัก", "ยกเวท"], activity: "ยกน้ำหนัก", mets: 5 },
];

function durationMin(text: string) {
  const n = text.replace(/หนึ่ง/g, "1").replace(/สอง/g, "2").replace(/สาม/g, "3").replace(/สี่/g, "4").replace(/ห้า/g, "5").replace(/สิบ/g, "10");
  const h = n.match(/(\d+(?:\.\d+)?)\s*ชั่วโมง/); if (h) return Number(h[1]) * 60;
  const m = n.match(/(\d+(?:\.\d+)?)\s*นาที/); if (m) return Number(m[1]);
  const s = n.match(/(\d+(?:\.\d+)?)\s*วินาที/); if (s) return Number(s[1]) / 60;
  return null;
}

function localActions(text: string): VoiceAction[] {
  const t = text.toLowerCase(); const out: VoiceAction[] = [];
  if (/(เพลงถัดไป|เพลงต่อไป|ข้ามเพลง|เปลี่ยนเพลง|next)/i.test(t)) out.push({ action: "NEXT_MUSIC" });
  else if (/(เพลงก่อน|ย้อนเพลง|previous)/i.test(t)) out.push({ action: "PREVIOUS_MUSIC" });
  else if (/(พักเพลง|หยุดชั่วคราว|pause)/i.test(t)) out.push({ action: "PAUSE_MUSIC" });
  else if (/(หยุดเพลง|ปิดเพลง|stop music)/i.test(t)) out.push({ action: "STOP_MUSIC" });
  else if (/(เปิดเพลง|เล่นเพลง|ขอเพลง|หาเพลง|play music)/i.test(t)) out.push({ action: "PLAY_MUSIC" });
  if (/(เปิด|ไป|เข้า).*(เพลง|เพลย์ลิสต์)/i.test(t)) out.push({ action: "OPEN_MUSIC" });
  if (/(เปิด|ไป|เข้า).*(ไดอารี|ไดอารี่|อาหารวันนี้)/i.test(t)) out.push({ action: "OPEN_DIARY" });
  if (/(เปิด|ไป|เข้า).*(สถิติ|สรุปวันนี้)/i.test(t)) out.push({ action: "OPEN_STATS" });
  if (/(เปิด|ไป|เข้า).*(สแกน|กล้องอาหาร)/i.test(t)) out.push({ action: "OPEN_SCAN" });
  if (/(เปิด|ไป|เข้า).*(บาร์โค้ด)/i.test(t)) out.push({ action: "OPEN_BARCODE" });
  if (/(เปิด|ไป|เข้า).*(นับก้าว|pedometer)/i.test(t)) out.push({ action: "OPEN_PEDOMETER" });
  if (/(เปิด|ไป|เข้า).*(ผู้ช่วย|แชท)/i.test(t)) out.push({ action: "OPEN_ASSISTANT" });
  if (/(ตั้งโปรไฟล์|แก้โปรไฟล์|ข้อมูลส่วนตัว)/i.test(t)) out.push({ action: "OPEN_PROFILE" });
  if (/(停止|หยุดเดิน|หยุดวิ่ง|หยุดปั่น|หยุดบันทึกเส้นทาง|หยุดออกกำลังกาย)/i.test(t)) out.push({ action: "STOP_GPS" });
  const start = /(เริ่มเดิน|ออกไปเดิน|เดินกัน|เริ่มวิ่ง|ออกไปวิ่ง|เริ่มปั่น|เริ่มออกกำลังกาย|เริ่มบันทึกเส้นทาง)/i.test(t);
  if (start) out.push({ action: /วิ่ง/.test(t) ? "START_RUN" : /ปั่น/.test(t) ? "START_CYCLE" : "START_WALK" });
  if (/(กี่แคล|แคลอรี|แคลอรี่|พลังงานวันนี้)/i.test(t)) out.push({ action: "SHOW_CALORIES" });
  if (/(กี่ก้าว|จำนวนก้าว|เดินไปกี่ก้าว)/i.test(t)) out.push({ action: "SHOW_STEPS" });
  return out;
}

async function askIntent(text: string): Promise<VoiceAction[]> {
  const system = `คุณคือ intent router ของ WK Health ภาษาไทย ผู้ใช้พูดได้อิสระมาก ห้ามจับคำตรงอย่างเดียว ให้เข้าใจความหมายจากบริบทและสำนวนทุกแบบ ตอบ JSON array เท่านั้น ห้าม markdown
ตัวอย่าง schema:
[{"action":"START_WALK"}]
[{"action":"STOP_GPS"}]
[{"action":"PLAY_MUSIC"},{"action":"START_WALK"}]
[{"action":"EXERCISE","activity":"เดิน","duration_min":30,"mets":3.5}]
[{"action":"SHOW_CALORIES"}]
[{"action":"SHOW_STEPS"}]
[{"action":"OPEN_DIARY"}]
[{"action":"NONE"}]
Allowed actions only: START_WALK,START_RUN,START_CYCLE,START_GPS,STOP_WALK,STOP_RUN,STOP_CYCLE,STOP_GPS,PLAY_MUSIC,PAUSE_MUSIC,STOP_MUSIC,NEXT_MUSIC,PREVIOUS_MUSIC,OPEN_MUSIC,OPEN_DIARY,OPEN_STATS,OPEN_SCAN,OPEN_BARCODE,OPEN_PEDOMETER,OPEN_ASSISTANT,OPEN_PROFILE,EXERCISE,SHOW_CALORIES,SHOW_STEPS,SAVE_MEAL,NONE.
ถ้าประโยคมีหลายเจตนาให้คืนหลาย action ตามลำดับที่ควรทำ ห้ามสร้าง action อื่นเอง`;
  const r = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: text }] }),
  });
  if (!r.ok) throw new Error("intent unavailable");
  const d = await r.json();
  const raw = String(d?.content ?? d?.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(raw); const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.filter((x: any) => x && typeof x.action === "string") as VoiceAction[];
}

function emit(action: VoiceAction) { window.dispatchEvent(new CustomEvent("wk:voice-action", { detail: action })); }

export function VoiceControl({ profileName, bodyWeightKg, onExercise, onStartGps, onStopGps, onOpenProfileModal }: VoiceControlProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [tts, setTts] = useState(() => typeof window === "undefined" ? true : localStorage.getItem(TTS_KEY) !== "0");
  const recognitionRef = useRef<any>(null);
  const say = useCallback((message: string) => { setReply(message); if (tts && "speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(message); u.lang = "th-TH"; u.rate = 1; window.speechSynthesis.speak(u); } }, [tts]);
  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const runActions = useCallback(async (actions: VoiceAction[]) => {
    let completed = 0;
    for (const a of actions) {
      emit(a); const key = a.action;
      if (key === "OPEN_PROFILE") { onOpenProfileModal(); completed++; continue; }
      if (key === "START_WALK" || key === "START_RUN" || key === "START_CYCLE" || key === "START_GPS") { onStartGps(); completed++; continue; }
      if (key === "STOP_WALK" || key === "STOP_RUN" || key === "STOP_CYCLE" || key === "STOP_GPS") { onStopGps(); completed++; continue; }
      if (key === "EXERCISE") { const mins = Math.max(1, Number(a.duration_min) || 20); const mets = Math.max(.5, Number(a.mets) || 3.5); const kcal = Math.round(mets * bodyWeightKg * mins / 60); onExercise({ activity: String(a.activity || "ออกกำลังกาย"), duration_min: mins, mets, kcal }); completed++; continue; }
      const route = ROUTES[key]; if (route) { await navigate({ to: route as any }); completed++; continue; }
      if (["PLAY_MUSIC","PAUSE_MUSIC","STOP_MUSIC","NEXT_MUSIC","PREVIOUS_MUSIC"].includes(key)) { const map: Record<string,string> = { PLAY_MUSIC:"play", PAUSE_MUSIC:"pause", STOP_MUSIC:"stop", NEXT_MUSIC:"next", PREVIOUS_MUSIC:"prev" }; window.dispatchEvent(new CustomEvent("wk:music", { detail: { action: map[key] } })); completed++; continue; }
      if (key === "SAVE_MEAL") { emit(a); completed++; continue; }
      if (key === "SHOW_CALORIES" || key === "SHOW_STEPS") { emit(a); completed++; continue; }
      if (key === "NONE") continue;
    }
    if (!completed) { const answer = await apiAssistantChat(text); say(answer.text || "รับทราบครับ"); return; }
    const labels = actions.map(a => ({START_WALK:"เริ่มเดิน",START_RUN:"เริ่มวิ่ง",START_CYCLE:"เริ่มปั่น",START_GPS:"เริ่มติดตาม",STOP_WALK:"หยุดเดิน",STOP_RUN:"หยุดวิ่ง",STOP_CYCLE:"หยุดปั่น",STOP_GPS:"หยุดติดตาม",PLAY_MUSIC:"เปิดเพลง",PAUSE_MUSIC:"พักเพลง",STOP_MUSIC:"ปิดเพลง",NEXT_MUSIC:"เพลงถัดไป",PREVIOUS_MUSIC:"เพลงก่อนหน้า",OPEN_MUSIC:"เปิดเพลง",OPEN_DIARY:"เปิดไดอารี",OPEN_STATS:"เปิดสถิติ",OPEN_SCAN:"เปิดสแกน",OPEN_BARCODE:"เปิดบาร์โค้ด",OPEN_PEDOMETER:"เปิดนับก้าว",OPEN_ASSISTANT:"เปิดผู้ช่วย",OPEN_PROFILE:"เปิดโปรไฟล์",EXERCISE:"บันทึกการออกกำลัง",SHOW_CALORIES:"ดูแคลอรี",SHOW_STEPS:"ดูก้าว",SAVE_MEAL:"บันทึกเมนู",NONE:""} as Record<string,string>)[a.action]).filter(Boolean);
    say(labels.length ? `เรียบร้อยครับ ${labels.join(" และ ")}` : "รับทราบครับ");
  }, [bodyWeightKg, navigate, onExercise, onOpenProfileModal, onStartGps, onStopGps, say, text]);

  const execute = useCallback(async (raw: string) => {
    const value = raw.trim(); if (!value) return; setText(value); setStatus("processing");
    try { let actions = localActions(value); if (!actions.length || actions.length === 1 && actions[0].action === "NONE") actions = await askIntent(value); else { try { const ai = await askIntent(value); if (ai.some(a => a.action !== "NONE")) actions = ai; } catch {} }
      await runActions(actions.length ? actions : [{ action: "NONE" }]); setStatus("success");
    } catch { try { const answer = await apiAssistantChat(value); setStatus("success"); say(answer.text || "รับทราบครับ"); } catch { setStatus("error"); say("ตอนนี้ผู้ช่วยเชื่อมต่อไม่ได้ครับ ลองใหม่อีกครั้ง"); } }
  }, [runActions, say]);

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus("error"); say("เบราว์เซอร์นี้ไม่รองรับการรับเสียงครับ"); return; }
    recognitionRef.current?.stop?.(); const r = new SR(); r.lang = "th-TH"; r.continuous = false; r.interimResults = true;
    r.onstart = () => { setStatus("listening"); setText(""); setReply(""); };
    r.onresult = (e: any) => { let finalText = "", interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const s = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += s; else interim += s; } setText(finalText || interim); if (finalText) void execute(finalText); };
    r.onerror = () => { setStatus("error"); say("ไม่ได้ยินเสียงครับ ลองกดไมค์แล้วพูดใหม่อีกครั้ง"); };
    r.onend = () => setStatus(s => s === "listening" ? "idle" : s); recognitionRef.current = r; try { r.start(); } catch { setStatus("error"); }
  };
  const toggleTts = () => { const next = !tts; setTts(next); localStorage.setItem(TTS_KEY, next ? "1" : "0"); if (!next) window.speechSynthesis?.cancel(); };
  const close = () => { recognitionRef.current?.stop?.(); setStatus("idle"); };

  return <div className="vc-fixed-wrap"><div className="vc-bar glass" style={{ height: status === "idle" ? 60 : 172 }}>
    <div className="vc-row"><button className={`vc-mic-btn ${status === "listening" ? "vc-breathe" : ""}`} onClick={startListening} aria-label="เปิดไมค์">{status === "processing" ? <Loader2 className="vc-icon vc-spin"/> : <Mic className="vc-icon"/>}</button>
      <div className="vc-status-text"><p>{status === "listening" ? "กำลังฟังภาษาไทย…" : status === "processing" ? "กำลังเข้าใจคำพูด…" : status === "error" ? "เกิดข้อผิดพลาด" : reply || "กดไมค์แล้วพูดได้อย่างอิสระ"}</p><p className="vc-subtext">{profileName ? `WK • ${profileName}` : "WK HEALTH • VOICE"}</p></div>
      <button onClick={toggleTts} className="press grid size-9 place-items-center rounded-xl" aria-label={tts ? "ปิดเสียงตอบกลับ" : "เปิดเสียงตอบกลับ"}>{tts ? <Volume2 className="size-4"/> : <VolumeX className="size-4"/>}</button>
      {status !== "idle" && <button onClick={close} className="press grid size-9 place-items-center rounded-xl" aria-label="ปิด"><X className="size-4"/></button>}
    </div>
    {status !== "idle" && <div className="vc-body vc-rise-in"><div className="vc-transcript-box"><p>{text || "พูดได้ทุกแบบ เช่น ‘เริ่มเดินแล้วเปิดเพลงให้ด้วย’"}</p></div>{status === "processing" && <div className="vc-processing"><Loader2 className="vc-icon-lg vc-spin vc-mint"/><p>กำลังวิเคราะห์ความหมายและสั่งระบบ…</p></div>}{status === "success" && <div className="vc-result-card"><div className="vc-result-head"><div className="vc-result-icon"><Check className="vc-icon"/></div><div><p className="vc-result-label">สำเร็จ</p><p>{reply}</p></div></div></div>}{status === "error" && <p className="vc-result-label">{reply}</p>}</div>}
  </div></div>;
}
