import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX, Loader2, Check, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
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
const VOICE_MODE_KEY = "wk_voice_mode_enabled";
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
  const n = text
    .replace(/สิบ/g, "10")
    .replace(/หนึ่ง/g, "1")
    .replace(/สอง/g, "2")
    .replace(/สาม/g, "3")
    .replace(/สี่/g, "4")
    .replace(/ห้า/g, "5")
    .replace(/หก/g, "6")
    .replace(/เจ็ด/g, "7")
    .replace(/แปด/g, "8")
    .replace(/เก้า/g, "9");
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
  if (/(หยุดเดิน|หยุดวิ่ง|หยุดปั่น|หยุดบันทึกเส้นทาง|หยุดออกกำลังกาย|พอแล้ว)/i.test(t)) out.push({ action: "STOP_GPS" });
  if (/(เริ่มเดิน|ออกไปเดิน|เดินกัน|เริ่มวิ่ง|ออกไปวิ่ง|เริ่มปั่น|เริ่มออกกำลังกาย|เริ่มบันทึกเส้นทาง|ไปออกกำลังกัน)/i.test(t)) {
    out.push({ action: /วิ่ง/.test(t) ? "START_RUN" : /ปั่น/.test(t) ? "START_CYCLE" : "START_WALK" });
  }
  if (/(กี่แคล|แคลอรี|แคลอรี่|พลังงานวันนี้)/i.test(t)) out.push({ action: "SHOW_CALORIES" });
  if (/(กี่ก้าว|จำนวนก้าว|เดินไปกี่ก้าว)/i.test(t)) out.push({ action: "SHOW_STEPS" });
  return out;
}

async function askIntent(text: string): Promise<VoiceAction[]> {
  const system = `คุณคือผู้เชี่ยวชาญภาษาไทยและเป็น intent router ของ WK Health
ผู้ใช้สามารถพูดภาษาไทยได้ทุกสำนวน ทุกระดับความสุภาพ พูดอ้อม พูดสั้น พูดยาว มีคำฟุ่มเฟือย พูดผิดเล็กน้อย หรือใช้คำใกล้เคียงกันได้ ให้ตีความ "ความหมาย" ไม่ใช่ค้นหาคำตรง ๆ

กฎสำคัญ:
- วิเคราะห์เป็นภาษาไทยก่อนเสมอ
- ผลลัพธ์ต้องเป็น JSON array เท่านั้น ห้ามมี markdown ห้ามมีคำอธิบาย
- ถ้ามีหลายเจตนา ให้คืนหลาย action ตามลำดับที่ควรทำ
- ใช้เฉพาะ action ที่อยู่ในรายการ Allowed actions
- ถ้าไม่เกี่ยวกับการควบคุมแอป ให้คืน NONE
- ถ้าเป็นกิจกรรมออกกำลังกาย ให้คืน EXERCISE พร้อม activity, duration_min และ mets ที่สมเหตุสมผล

Allowed actions:
START_WALK,START_RUN,START_CYCLE,START_GPS,STOP_WALK,STOP_RUN,STOP_CYCLE,STOP_GPS,
PLAY_MUSIC,PAUSE_MUSIC,STOP_MUSIC,NEXT_MUSIC,PREVIOUS_MUSIC,
OPEN_MUSIC,OPEN_DIARY,OPEN_STATS,OPEN_SCAN,OPEN_BARCODE,OPEN_PEDOMETER,OPEN_ASSISTANT,OPEN_PROFILE,
EXERCISE,SHOW_CALORIES,SHOW_STEPS,SAVE_MEAL,NONE.`;
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

async function askThaiAssistant(text: string) {
  const system = `คุณคือผู้ช่วย WK Health ที่สื่อสารภาษาไทยอย่างเป็นธรรมชาติเท่านั้น
ตอบเป็นภาษาไทยทุกครั้ง ห้ามตอบภาษาอังกฤษ แม้คำถามจะมีภาษาอังกฤษปน
ใช้ภาษาพูดสุภาพ เป็นกันเอง กระชับ และเข้าใจง่าย
ถ้าจำเป็นต้องใช้ศัพท์เทคนิค ให้เขียนคำอธิบายภาษาไทยกำกับ
อย่าอ้างว่าคุณทำสิ่งใดสำเร็จ ถ้ายังไม่ได้ทำจริงผ่าน action ของระบบ`;
  const r = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: text }] }),
  });
  if (!r.ok) throw new Error("assistant unavailable");
  const d = await r.json();
  return String(d?.content ?? d?.choices?.[0]?.message?.content ?? "รับทราบครับ").trim();
}

function emit(action: VoiceAction) { window.dispatchEvent(new CustomEvent("wk:voice-action", { detail: action })); }

function chooseThaiVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => /^th[-_]/i.test(v.lang))
    ?? voices.find((v) => v.lang.toLowerCase().startsWith("th"))
    ?? voices.find((v) => /thai|ไทย/i.test(v.name));
}

export function VoiceControl({ profileName, bodyWeightKg, onExercise, onStartGps, onStopGps, onOpenProfileModal }: VoiceControlProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [tts, setTts] = useState(() => typeof window === "undefined" ? true : localStorage.getItem(TTS_KEY) !== "0");
  const [voiceMode, setVoiceMode] = useState(() => typeof window === "undefined" ? false : localStorage.getItem(VOICE_MODE_KEY) === "1");

  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(voiceMode);
  const ttsRef = useRef(tts);
  const speakingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executeRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { ttsRef.current = tts; }, [tts]);

  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    try { recognitionRef.current?.stop?.(); } catch {}
    recognitionRef.current = null;
  }, []);

  const startRecognition = useCallback(() => {
    if (!voiceModeRef.current || speakingRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus("error"); setReply("เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียงครับ"); return; }

    stopRecognition();
    const r = new SR();
    r.lang = "th-TH";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.onstart = () => setStatus("listening");
    r.onresult = (event: any) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const s = String(event.results[i][0]?.transcript ?? "").trim();
        if (event.results[i].isFinal) finalText += `${s} `;
        else interim += s;
      }
      setText(finalText.trim() || interim.trim());
      if (finalText.trim()) void executeRef.current(finalText.trim());
    };
    r.onerror = (event: any) => {
      if (!voiceModeRef.current) return;
      if (event?.error === "not-allowed" || event?.error === "permission-denied") {
        setStatus("error");
        setReply("ต้องอนุญาตไมโครโฟนก่อนครับ");
        setVoiceMode(false);
        return;
      }
      if (event?.error !== "aborted" && !speakingRef.current) {
        setStatus("error");
        setReply("ไม่ได้ยินเสียงครับ ลองพูดใหม่ได้เลย");
        restartTimerRef.current = setTimeout(startRecognition, 500);
      }
    };
    r.onend = () => {
      recognitionRef.current = null;
      if (voiceModeRef.current && !speakingRef.current) {
        restartTimerRef.current = setTimeout(startRecognition, 250);
      }
    };
    recognitionRef.current = r;
    try { r.start(); } catch { recognitionRef.current = null; }
  }, [stopRecognition]);

  const speakThai = useCallback((message: string) => {
    setReply(message);
    if (!ttsRef.current || !("speechSynthesis" in window)) {
      speakingRef.current = false;
      if (voiceModeRef.current) restartTimerRef.current = setTimeout(startRecognition, 120);
      return;
    }

    speakingRef.current = true;
    stopRecognition();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "th-TH";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voice = chooseThaiVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      speakingRef.current = false;
      if (voiceModeRef.current) restartTimerRef.current = setTimeout(startRecognition, 150);
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      if (voiceModeRef.current) restartTimerRef.current = setTimeout(startRecognition, 150);
    };
    window.speechSynthesis.speak(utterance);
  }, [startRecognition, stopRecognition]);

  const runActions = useCallback(async (actions: VoiceAction[], originalText: string) => {
    let completed = 0;
    for (const a of actions) {
      const key = a.action;
      emit(a);
      if (key === "OPEN_PROFILE") { onOpenProfileModal(); completed++; continue; }
      if (key === "START_WALK" || key === "START_RUN" || key === "START_CYCLE" || key === "START_GPS") { onStartGps(); completed++; continue; }
      if (key === "STOP_WALK" || key === "STOP_RUN" || key === "STOP_CYCLE" || key === "STOP_GPS") { onStopGps(); completed++; continue; }
      if (key === "EXERCISE") {
        const mins = Math.max(1, Number(a.duration_min) || durationMin(originalText) || 20);
        const mets = Math.max(0.5, Number(a.mets) || 3.5);
        onExercise({ activity: String(a.activity || "ออกกำลังกาย"), duration_min: mins, mets, kcal: Math.round(mets * bodyWeightKg * mins / 60) });
        completed++; continue;
      }
      const route = ROUTES[key];
      if (route) { await navigate({ to: route as any }); completed++; continue; }
      if (["PLAY_MUSIC", "PAUSE_MUSIC", "STOP_MUSIC", "NEXT_MUSIC", "PREVIOUS_MUSIC"].includes(key)) {
        const map: Record<string, string> = { PLAY_MUSIC: "play", PAUSE_MUSIC: "pause", STOP_MUSIC: "stop", NEXT_MUSIC: "next", PREVIOUS_MUSIC: "prev" };
        window.dispatchEvent(new CustomEvent("wk:music", { detail: { action: map[key] } })); completed++; continue;
      }
      if (key === "SAVE_MEAL" || key === "SHOW_CALORIES" || key === "SHOW_STEPS") { completed++; continue; }
    }

    if (!completed || actions.every((a) => a.action === "NONE")) {
      try {
        const answer = await askThaiAssistant(originalText);
        setStatus("success");
        speakThai(answer || "รับทราบครับ");
      } catch {
        setStatus("error");
        speakThai("ตอนนี้เชื่อมต่อผู้ช่วยไม่ได้ครับ ลองใหม่อีกครั้งได้เลย");
      }
      return;
    }

    const labels: Record<string, string> = {
      START_WALK: "เริ่มเดิน", START_RUN: "เริ่มวิ่ง", START_CYCLE: "เริ่มปั่น", START_GPS: "เริ่มติดตาม",
      STOP_WALK: "หยุดเดิน", STOP_RUN: "หยุดวิ่ง", STOP_CYCLE: "หยุดปั่น", STOP_GPS: "หยุดติดตาม",
      PLAY_MUSIC: "เปิดเพลง", PAUSE_MUSIC: "พักเพลง", STOP_MUSIC: "ปิดเพลง", NEXT_MUSIC: "เพลงถัดไป", PREVIOUS_MUSIC: "เพลงก่อนหน้า",
      OPEN_MUSIC: "เปิดเพลง", OPEN_DIARY: "เปิดไดอารี", OPEN_STATS: "เปิดสถิติ", OPEN_SCAN: "เปิดสแกน", OPEN_BARCODE: "เปิดบาร์โค้ด",
      OPEN_PEDOMETER: "เปิดนับก้าว", OPEN_ASSISTANT: "เปิดผู้ช่วย", OPEN_PROFILE: "เปิดโปรไฟล์", EXERCISE: "บันทึกการออกกำลัง",
      SHOW_CALORIES: "ดูแคลอรี", SHOW_STEPS: "ดูก้าว", SAVE_MEAL: "บันทึกเมนู",
    };
    const names = actions.map((a) => labels[a.action]).filter(Boolean);
    setStatus("success");
    speakThai(names.length ? `เรียบร้อยครับ ${names.join(" และ ")}` : "รับทราบครับ");
  }, [bodyWeightKg, navigate, onExercise, onOpenProfileModal, onStartGps, onStopGps, speakThai]);

  const execute = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setText(value);
    setStatus("processing");
    try {
      let actions = localActions(value);
      try {
        const aiActions = await askIntent(value);
        if (aiActions.some((a) => a.action !== "NONE")) actions = aiActions;
      } catch {}
      await runActions(actions.length ? actions : [{ action: "NONE" }], value);
    } catch {
      setStatus("error");
      speakThai("ขอโทษครับ ระบบขัดข้องชั่วคราว ลองพูดใหม่อีกครั้งได้เลย");
    }
  }, [runActions, speakThai]);

  useEffect(() => { executeRef.current = execute; }, [execute]);

  const startVoiceMode = useCallback(() => {
    setVoiceMode(true);
    localStorage.setItem(VOICE_MODE_KEY, "1");
    setReply("พร้อมฟังครับ พูดภาษาไทยได้ตามธรรมชาติเลย");
    startRecognition();
  }, [startRecognition]);

  const stopVoiceMode = useCallback(() => {
    setVoiceMode(false);
    localStorage.setItem(VOICE_MODE_KEY, "0");
    speakingRef.current = false;
    stopRecognition();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("idle");
    setReply("ปิดระบบเสียงแล้วครับ");
  }, [stopRecognition]);

  const toggleTts = useCallback(() => {
    const next = !ttsRef.current;
    ttsRef.current = next;
    setTts(next);
    localStorage.setItem(TTS_KEY, next ? "1" : "0");
    if (!next && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
      if (voiceModeRef.current) startRecognition();
    }
  }, [startRecognition]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.onvoiceschanged = () => { void chooseThaiVoice(); };
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => () => {
    stopRecognition();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [stopRecognition]);

  const expanded = voiceMode || status !== "idle";

  return (
    <div className="vc-fixed-wrap">
      <div className="vc-bar glass" style={{ height: expanded ? 172 : 60 }}>
        <div className="vc-row">
          <button
            type="button"
            className={`vc-mic-btn ${voiceMode && status === "listening" ? "vc-breathe" : ""}`}
            onClick={() => (voiceMode ? stopVoiceMode() : startVoiceMode())}
            aria-label={voiceMode ? "ปิดระบบเสียง" : "เปิดระบบเสียงภาษาไทย"}
          >
            {status === "processing" ? <Loader2 className="vc-icon vc-spin" /> : voiceMode ? <X className="vc-icon" /> : <Mic className="vc-icon" />}
            {voiceMode && status === "listening" && <span className="vc-ripple" />}
          </button>

          <div className="vc-status-text">
            <p>{status === "listening" ? "กำลังฟังภาษาไทย…" : status === "processing" ? "กำลังวิเคราะห์ความหมาย…" : status === "error" ? (reply || "เกิดข้อผิดพลาด") : reply || "กดไมค์เพื่อเริ่มคุยภาษาไทย"}</p>
            <p className="vc-subtext">{voiceMode ? "โหมดสนทนาเรียลไทม์ • พูดต่อได้หลัง AI ตอบ" : profileName ? `WK • ${profileName}` : "WK HEALTH • VOICE"}</p>
          </div>

          <button onClick={toggleTts} className="press grid size-9 place-items-center rounded-xl" aria-label={tts ? "ปิดเสียง AI" : "เปิดเสียง AI"}>
            {tts ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>

        {expanded && (
          <div className="vc-body vc-rise-in">
            {status === "listening" && (
              <div>
                <div className="vc-waveform">
                  <span className="vc-waveform-bar" style={{ height: "55%" }} />
                  <span className="vc-waveform-bar" style={{ height: "90%" }} />
                  <span className="vc-waveform-bar" style={{ height: "45%" }} />
                  <span className="vc-waveform-bar" style={{ height: "75%" }} />
                  <span className="vc-waveform-bar" style={{ height: "60%" }} />
                </div>
                <div className="vc-transcript-box"><p>{text || "พูดได้ตามธรรมชาติ เช่น ‘เริ่มเดินแล้วเปิดเพลงให้ด้วย’"}<span className="vc-caret" /></p></div>
              </div>
            )}
            {status === "processing" && <div className="vc-processing"><Loader2 className="vc-icon-lg vc-spin vc-mint" /><p>กำลังเข้าใจภาษาไทยและทำตามคำสั่ง…</p></div>}
            {status === "success" && <div className="vc-result-card"><div className="vc-result-head"><div className="vc-result-icon"><Check className="vc-icon" /></div><div><p className="vc-result-label">พร้อมคุยต่อ</p><p className="vc-result-title">{reply || "ดำเนินการเรียบร้อยแล้ว"}</p></div></div></div>}
            {status === "error" && <div className="vc-error-box"><p>{reply || "ลองพูดใหม่อีกครั้งครับ"}</p></div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceControl;
