import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, Volume2, VolumeX, Loader2, Check, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { apiCalc, apiFetch, ApiError } from "@/lib/api";
import { apiSaveMeal } from "@/lib/meal-save";
import { apiAssistantChatWithContext } from "@/lib/website-ai-context";
import { gpsBridge } from "@/lib/gps-bridge";
import { geocodePlace, haversineKm, bearingDeg, compassThai } from "@/lib/geo";
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
  | { action: "START_WALK" | "START_RUN" | "START_CYCLE" | "START_GPS"; km?: number }
  | { action: "STOP_WALK" | "STOP_RUN" | "STOP_CYCLE" | "STOP_GPS" }
  | { action: "PLAY_MUSIC" | "PAUSE_MUSIC" | "STOP_MUSIC" | "NEXT_MUSIC" | "PREVIOUS_MUSIC" }
  | { action: "OPEN_MUSIC" | "OPEN_DIARY" | "OPEN_STATS" | "OPEN_SCAN" | "OPEN_BARCODE" | "OPEN_PEDOMETER" | "OPEN_ASSISTANT" | "OPEN_PROFILE" }
  | { action: "EXERCISE"; activity: string; duration_min: number; mets: number }
  | { action: "SHARE_LOCATION" }
  | { action: "LOG_FOOD_TEXT"; text: string }
  | { action: "ADD_CALORIES"; amount: number }
  | { action: "REMOVE_CAL_UNSUPPORTED" }
  | { action: "SET_DESTINATION"; place: string }
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

function parseCalorieAmount(text: string): number | null {
  const n = text
    .replace(/สิบ/g, "10").replace(/หนึ่ง/g, "1").replace(/สอง/g, "2").replace(/สาม/g, "3")
    .replace(/สี่/g, "4").replace(/ห้า/g, "5").replace(/หก/g, "6").replace(/เจ็ด/g, "7")
    .replace(/แปด/g, "8").replace(/เก้า/g, "9").replace(/ร้อย/g, "00");
  const m = n.match(/(\d+)/);
  return m ? Number(m[1]) : null;
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
  if (/(แชร์ตำแหน่ง|แชร์โลเคชั่น|แชร์โลเคชัน|ส่งพิกัด|แชร์พิกัด|ส่งตำแหน่ง)/i.test(t)) out.push({ action: "SHARE_LOCATION" });
  // FIX: เพิ่มใหม่ — "ไปเที่ยว.../นำทางไป.../พาไปที่.../ไปหา..." -> มาร์กเป้าหมายบนแผนที่ + บอกระยะทาง/ทิศทาง
  // ถ้าพูดจบไม่ได้บอกชื่อสถานที่ (แค่ "ไปเที่ยว" เฉยๆ) place จะเป็นค่าว่าง แล้วให้ runActions ถามกลับ
  const destMatch = t.match(/(?:ไปเที่ยว|นำทางไป|พาไปที่|พาไป|ไปหา)\s*(.*)/i);
  if (destMatch) out.push({ action: "SET_DESTINATION", place: (destMatch[1] || "").trim() });
  if (/(มาร์กเป้าหมาย|ปักหมุด)/i.test(t) && !destMatch) out.push({ action: "SET_DESTINATION", place: "" });
  if (/(หยุดเดิน|หยุดวิ่ง|หยุดปั่น|หยุดบันทึกเส้นทาง|หยุดออกกำลังกาย|พอแล้ว)/i.test(t)) out.push({ action: "STOP_GPS" });
  if (/(เริ่มเดิน|ออกไปเดิน|เดินกัน|เริ่มวิ่ง|ออกไปวิ่ง|ไปวิ่ง|อยากวิ่ง|วิ่งนับก้าว|ไปวิ่งนับก้าว|เริ่มปั่น|เริ่มออกกำลังกาย|เริ่มบันทึกเส้นทาง|ไปออกกำลังกัน|อยากเดิน|ไปเดินนับก้าว)/i.test(t)) {
    const kmMatch = t.match(/(\d+(?:\.\d+)?)\s*(กิโล|กม|km)/i);
    out.push({ action: /วิ่ง/.test(t) ? "START_RUN" : /ปั่น/.test(t) ? "START_CYCLE" : "START_WALK", km: kmMatch ? Number(kmMatch[1]) : undefined });
  }
  if (/(กี่แคล|แคลอรี|แคลอรี่|พลังงานวันนี้)/i.test(t) && !/(เพิ่ม|บวก)/i.test(t)) out.push({ action: "SHOW_CALORIES" });
  if (/(กี่ก้าว|จำนวนก้าว|เดินไปกี่ก้าว)/i.test(t)) out.push({ action: "SHOW_STEPS" });

  // FIX: เพิ่มใหม่ — เดิมสั่งเสียงบันทึกอาหาร/ปรับแคลไม่ได้เลย ต้องเข้าแอปกดเองเท่านั้น
  // "เพิ่มแคล 300" / "บวกแคล 300" -> บันทึกรายการแคลอรีด้วยตัวเลขที่พูดตรงๆ (ไม่ผ่าน AI วิเคราะห์อาหาร)
  const addCalMatch = /(เพิ่มแคล|บวกแคล|เพิ่มพลังงาน)/i.test(t);
  if (addCalMatch) {
    const amount = parseCalorieAmount(t);
    out.push(amount !== null ? { action: "ADD_CALORIES", amount } : { action: "ADD_CALORIES", amount: -1 });
  }
  // "ลบแคล/หักแคล" — backend ยังไม่มี endpoint ลบ/หักรายการไดอารี ตอนนี้ทำได้แค่ "เพิ่ม" เท่านั้น
  // ไม่ทำเป็น ADD_CALORIES ปลอมๆ เพราะจะลวงว่าลบสำเร็จทั้งที่ไม่ได้ลบจริง ให้ไปตอบอธิบายตรงๆ ผ่าน NONE -> AI ตอบ
  // "กิน.../ทาน..." — พูดชื่ออาหารแล้วให้ AI วิเคราะห์แคลอรีเองและบันทึกลงไดอารีให้ทันที
  if (!addCalMatch && !/(ลบแคล|หักแคล|ลดแคล)/i.test(t) && /(กิน|ทาน)/i.test(t) && !/(หยุดกิน)/i.test(t)) {
    out.push({ action: "LOG_FOOD_TEXT", text });
  }
  if (/(ลบแคล|หักแคล|ลดแคล)/i.test(t)) out.push({ action: "REMOVE_CAL_UNSUPPORTED" });
  return out;
}

async function askIntent(text: string): Promise<VoiceAction[]> {
  try {
    const data = await apiFetch<{ success: boolean; actions?: unknown[]; error?: string }>(
      "/api/voice/interpret",
      { method: "POST", body: { text } }
    );
    const list = Array.isArray(data.actions) ? data.actions : [];
    return list.filter((x: any) => x && typeof x.action === "string") as VoiceAction[];
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : "intent unavailable");
  }
}

// FIX: เดิมเรียก /api/assistant/chat ตรงๆ ด้วยข้อความล้วน ไม่มีบริบทอะไรเลย
// เปลี่ยนมาใช้ apiAssistantChatWithContext ตัวเดียวกับหน้าแชท — แนบข้อมูลจริงจากทั้งเว็บ
// (ไดอารี, สถิติ, ก้าวเดิน, ประวัติออกกำลังกาย, เพลง, ประวัติแชทเดิม ฯลฯ) ไปทุกครั้งที่ถามด้วยเสียง
async function askThaiAssistant(text: string) {
  try {
    const reply = await apiAssistantChatWithContext(text);
    return String(reply.text || "รับทราบครับ").trim();
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : "assistant unavailable");
  }
}

function emit(action: VoiceAction) { window.dispatchEvent(new CustomEvent("wk:voice-action", { detail: action })); }

function chooseThaiVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => /^th[-_]/i.test(v.lang))
    ?? voices.find((v) => v.lang.toLowerCase().startsWith("th"))
    ?? voices.find((v) => /thai|ไทย/i.test(v.name));
}

function detectSlot(date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 10) return "มื้อเช้า";
  if (h >= 10 && h < 14) return "มื้อกลางวัน";
  if (h >= 17 && h < 21) return "มื้อเย็น";
  return "ของว่าง";
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
  // FIX: เพิ่มใหม่ — กลไกถาม-ตอบต่อเนื่อง: ถ้าระบบถามคำถามกลับ (เช่น "กี่นาทีครับ") จะเก็บ callback
  // ไว้ตรงนี้ แล้วให้คำพูดรอบถัดไปของผู้ใช้ถูกตีความเป็น "คำตอบ" แทนที่จะตีเป็นคำสั่งใหม่
  const pendingQuestionRef = useRef<((answer: string) => Promise<void>) | null>(null);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { ttsRef.current = tts; }, [tts]);

  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    try { recognitionRef.current?.stop?.(); } catch {}
    recognitionRef.current = null;
  }, []);

  const startRecognition = useCallback(() => {
    if (!voiceModeRef.current || speakingRef.current) return;
    // FIX: เพิ่มใหม่ — Web Speech API ต้องใช้บน HTTPS (หรือ localhost) เท่านั้น ถ้าเปิดผ่าน HTTP
    // เฉยๆ (เช่น IP วง LAN ตอน dev) เบราว์เซอร์จะไม่มี SpeechRecognition ให้เลยแบบเงียบๆ
    // เดิมข้อความ error ก็ไม่เคยถูกแสดงผลอยู่แล้ว (ดู FIX ที่ปุ่มไมค์ด้านล่าง) ผู้ใช้เลยไม่รู้สาเหตุ
    if (!window.isSecureContext) {
      setStatus("error");
      setReply("ต้องเปิดผ่าน HTTPS ถึงจะใช้สั่งงานด้วยเสียงได้ครับ");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus("error"); setReply("เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียงครับ ลองใช้ Chrome ดูนะครับ"); return; }

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
      if (key === "START_WALK" || key === "START_RUN" || key === "START_CYCLE" || key === "START_GPS") {
        // FIX: เพิ่มใหม่ — "อยากวิ่งกี่กิโล" ตามที่ขอ: ถ้าสั่งวิ่ง/เดิน/ปั่นแต่ไม่ได้บอกระยะทางมาด้วย
        // ให้ถามกลับก่อนเริ่ม GPS จริง (START_GPS ที่มาจากปุ่มกดตรงๆ ไม่ต้องถาม เพราะเป็นคำสั่งกดปุ่ม)
        const activityLabel = key === "START_RUN" ? "วิ่ง" : key === "START_CYCLE" ? "ปั่นจักรยาน" : "เดิน";
        const askKmThenStart = async (answer: string) => {
          const amt = parseCalorieAmount(answer);
          if (amt !== null && amt > 0) await gpsBridge.setGoalKm(amt);
          onStartGps();
          speakThai(amt ? `เริ่ม${activityLabel} เป้าหมาย ${amt} กิโลครับ ลุยเลย!` : `เริ่ม${activityLabel}ให้แล้วครับ`);
        };
        if (key !== "START_GPS" && a.km === undefined) {
          speakThai(`อยาก${activityLabel}กี่กิโลครับ`);
          pendingQuestionRef.current = askKmThenStart;
          return;
        }
        if (a.km) await gpsBridge.setGoalKm(a.km);
        onStartGps();
        completed++; continue;
      }
      if (key === "STOP_WALK" || key === "STOP_RUN" || key === "STOP_CYCLE" || key === "STOP_GPS") { onStopGps(); completed++; continue; }
      if (key === "SHARE_LOCATION") { await gpsBridge.shareLocation(); completed++; continue; }
      if (key === "ADD_CALORIES") {
        if (a.amount < 0) {
          speakThai("เพิ่มแคลกี่แคลครับ บอกตัวเลขมาได้เลย");
          pendingQuestionRef.current = async (answer: string) => {
            const amt = parseCalorieAmount(answer);
            if (amt === null) { speakThai("ไม่เข้าใจตัวเลขครับ ลองพูดใหม่อีกครั้ง"); return; }
            try {
              await apiSaveMeal({ foodName: "รายการที่เพิ่มด้วยเสียง", calories: amt, slot: detectSlot(), meal: detectSlot(), description: "เพิ่มแคลด้วยเสียง", source: "manual" });
              speakThai(`เพิ่ม ${amt} แคลให้แล้วครับ`);
            } catch {
              speakThai("บันทึกแคลไม่สำเร็จครับ ลองใหม่อีกครั้ง");
            }
          };
          return;
        }
        try {
          await apiSaveMeal({ foodName: "รายการที่เพิ่มด้วยเสียง", calories: a.amount, slot: detectSlot(), meal: detectSlot(), description: "เพิ่มแคลด้วยเสียง", source: "manual" });
          speakThai(`เพิ่ม ${a.amount} แคลให้แล้วครับ`);
        } catch {
          speakThai("บันทึกแคลไม่สำเร็จครับ ลองใหม่อีกครั้ง");
        }
        return;
      }
      // FIX: เพิ่มใหม่ — พูดชื่ออาหารแล้วให้ AI วิเคราะห์แคลอรีเองและบันทึกลงไดอารีทันที (ไม่ต้องเข้าแอปกดเอง)
      // ถ้า AI วิเคราะห์ไม่ได้/ไม่ชัด จะถามกลับด้วยเสียงแทนที่จะเดาสุ่มหรือปล่อยเงียบ
      if (key === "REMOVE_CAL_UNSUPPORTED") {
        speakThai("ตอนนี้ระบบยังลบหรือหักแคลไม่ได้ครับ เพิ่มแคลได้อย่างเดียว ต้องเข้าแอปไปลบรายการเองก่อนนะครับ");
        return;
      }
      if (key === "SET_DESTINATION") {
        const resolveDestination = async (placeName: string) => {
          const name = placeName.trim();
          if (!name) { speakThai("ไปเที่ยวที่ไหนครับ บอกชื่อสถานที่มาได้เลย"); pendingQuestionRef.current = resolveDestination; return; }
          try {
            const loc = await geocodePlace(name);
            if (!loc) { speakThai(`หาสถานที่ "${name}" ไม่เจอครับ ลองบอกชื่อให้ชัดอีกนิด`); return; }
            await gpsBridge.setDestination(loc);
            let extra = "";
            try {
              const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
              const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              const distKm = haversineKm(here, loc);
              extra = `ห่างจากตรงนี้ประมาณ ${distKm.toFixed(1)} กิโลเมตร อยู่ทาง${compassThai(bearingDeg(here, loc))} `;
            } catch {}
            speakThai(`ปักหมุด ${loc.label} ให้แล้วครับ ${extra}เปิดหน้า GPS เพื่อดูเส้นทางได้เลย`);
            await navigate({ to: "/pedometer" });
          } catch {
            speakThai("ค้นหาสถานที่ไม่สำเร็จครับ ลองใหม่อีกครั้ง");
          }
        };
        await resolveDestination(a.place);
        return;
      }
      // FIX: เพิ่มใหม่ — พูดชื่ออาหารแล้วให้ AI วิเคราะห์แคลอรีเองและบันทึกลงไดอารีทันที (ไม่ต้องเข้าแอปกดเอง)
      // ถ้า AI วิเคราะห์ไม่ได้/ไม่ชัด จะถามกลับด้วยเสียงแทนที่จะเดาสุ่มหรือปล่อยเงียบ
      if (key === "LOG_FOOD_TEXT") {
        try {
          const result = await apiCalc(a.text);
          if (!result?.name || !(result.kcal > 0)) {
            speakThai("ไม่แน่ใจว่ากินอะไรครับ บอกเมนูให้ชัดอีกนิดได้ไหม");
            pendingQuestionRef.current = async (answer: string) => {
              try {
                const r2 = await apiCalc(answer);
                await apiSaveMeal({ foodName: r2.name, calories: r2.kcal, protein: r2.protein, carbs: r2.carb, fat: r2.fat, slot: detectSlot(), meal: detectSlot(), description: answer, source: "manual" });
                speakThai(`บันทึก ${r2.name} ${r2.kcal} แคลให้แล้วครับ`);
              } catch {
                speakThai("บันทึกอาหารไม่สำเร็จครับ ลองใหม่อีกครั้ง");
              }
            };
            return;
          }
          await apiSaveMeal({ foodName: result.name, calories: result.kcal, protein: result.protein, carbs: result.carb, fat: result.fat, slot: detectSlot(), meal: detectSlot(), description: a.text, source: "manual" });
          speakThai(`บันทึก ${result.name} ${result.kcal} แคลให้แล้วครับ`);
        } catch {
          speakThai("วิเคราะห์อาหารไม่สำเร็จครับ ลองพูดใหม่อีกครั้ง");
        }
        return;
      }
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
      SHOW_CALORIES: "ดูแคลอรี", SHOW_STEPS: "ดูก้าว", SAVE_MEAL: "บันทึกเมนู", SHARE_LOCATION: "แชร์ตำแหน่ง",
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
    // FIX: ถ้ามีคำถามค้างอยู่ (ระบบเพิ่งถามกลับ เช่น "เท่าไหร่ครับ") ให้ตีความประโยคนี้เป็น "คำตอบ"
    // ของคำถามนั้นแทนที่จะพยายามจับ intent ใหม่ — ทำให้พูดคุยถาม-ตอบต่อเนื่องกันได้จริง
    if (pendingQuestionRef.current) {
      const handler = pendingQuestionRef.current;
      pendingQuestionRef.current = null;
      try {
        await handler(value);
        setStatus("success");
      } catch {
        setStatus("error");
        speakThai("ขอโทษครับ ระบบขัดข้องชั่วคราว ลองพูดใหม่อีกครั้งได้เลย");
      }
      return;
    }
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

  // FIX: บั๊กใหญ่ 🔴 — เดิม render ปุ่มไมค์ตรงตำแหน่งที่ FloatingControls ถูกวางไว้ในต้นไม้ React
  // ถ้ามี ancestor ไหนก็ตามที่มี CSS transform (เช่นแอนิเมชัน .rise-in ที่หลายหน้าใช้ห่อทั้งหน้า)
  // position:fixed ของปุ่มจะเทียบกับ ancestor นั้นแทนที่จะเทียบกับหน้าจอจริง ทำให้ปุ่มลอยไปโผล่
  // กลางหน้า ทับหัวข้อ/การ์ดแทนที่จะลอยชิดขอบจอ (ตามที่เจอในสกรีนช็อต) — เปลี่ยนมา render ผ่าน
  // React Portal เข้า document.body ตรงๆ กันปัญหานี้เกิดซ้ำไม่ว่าใครจะห่อ component นี้ด้วยอะไรก็ตาม
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);

  // FIX: บั๊กใหญ่ 🔴 — ปุ่มไมค์ทำงานจริงเบื้องหลัง (เริ่มฟัง/ประมวลผล/ตอบกลับ) แต่ไม่เคย render
  // สถานะ (status) หรือข้อความตอบกลับ (reply) ให้ผู้ใช้เห็นเลยสักที่ — ผู้ใช้กดแล้วเห็นแค่ไอคอน
  // เปลี่ยนไปมา ไม่รู้ว่ากำลังฟังอยู่ไหม ได้ยินว่าอะไร หรือ error อะไร (เช่น เบราว์เซอร์ไม่รองรับ,
  // ไม่ได้อนุญาตไมค์) เพิ่มแผงข้อความสถานะข้างปุ่ม ใช้ class ที่มี CSS รองรับอยู่แล้วใน voice-control.css
  const statusDotClass =
    status === "error" ? "vc-dot-error" :
    status === "processing" ? "vc-dot-processing" :
    status === "listening" || status === "success" ? "vc-dot-listening" : "vc-dot-idle";

  const button = (
    <div className="vc-fixed-wrap" style={{ flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      {voiceMode && (reply || text || status !== "idle") && (
        <div className="vc-bar glass vc-rise-in" style={{ padding: "10px 14px", maxWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`vc-dot ${statusDotClass}`} />
            <div className="vc-status-text">
              <p className={status === "error" ? "vc-error-text" : ""}>
                {status === "listening" && !text ? "กำลังฟัง..." : status === "processing" ? "กำลังประมวลผล..." : (reply || text || "พร้อมฟังครับ")}
              </p>
            </div>
          </div>
          {text && status !== "idle" && (
            <div className="vc-transcript-box">
              <p>{text}</p>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className={`vc-mic-btn vc-toggle-only ${voiceMode && status === "listening" ? "vc-breathe" : ""}`}
        onClick={() => (voiceMode ? stopVoiceMode() : startVoiceMode())}
        aria-label={voiceMode ? "ปิดระบบควบคุมเสียง" : "เปิดระบบควบคุมเสียง"}
        aria-pressed={voiceMode}
        title={voiceMode ? "ปิดระบบควบคุมเสียง" : "เปิดระบบควบคุมเสียง"}
      >
        {status === "processing" ? <Loader2 className="vc-icon vc-spin" /> : voiceMode ? <X className="vc-icon" /> : <Mic className="vc-icon" />}
        {voiceMode && status === "listening" && <span className="vc-ripple" />}
      </button>
    </div>
  );

  if (!portalReady) return null;
  return createPortal(button, document.body);
}

export default VoiceControl;
