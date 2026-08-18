import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX, Loader2, Check, X, ShieldAlert } from "lucide-react";
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
  OPEN_MUSIC: "/music",
  OPEN_DIARY: "/diary",
  OPEN_STATS: "/stats",
  OPEN_SCAN: "/scan",
  OPEN_BARCODE: "/barcode",
  OPEN_PEDOMETER: "/pedometer",
  OPEN_ASSISTANT: "/assistant",
};

function durationMin(text: string) {
  const normalized = text
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
  const h = normalized.match(/(\d+(?:\.\d+)?)\s*ชั่วโมง/);
  if (h) return Number(h[1]) * 60;
  const m = normalized.match(/(\d+(?:\.\d+)?)\s*นาที/);
  if (m) return Number(m[1]);
  const s = normalized.match(/(\d+(?:\.\d+)?)\s*วินาที/);
  if (s) return Number(s[1]) / 60;
  return null;
}

function localActions(text: string): VoiceAction[] {
  const t = text.toLowerCase();
  const actions: VoiceAction[] = [];
  if (/เพลงถัดไป|เพลงต่อไป|ข้ามเพลง|เปลี่ยนเพลง|next/i.test(t)) actions.push({ action: "NEXT_MUSIC" });
  else if (/เพลงก่อน|ย้อนเพลง|previous/i.test(t)) actions.push({ action: "PREVIOUS_MUSIC" });
  else if (/พักเพลง|หยุดชั่วคราว|pause/i.test(t)) actions.push({ action: "PAUSE_MUSIC" });
  else if (/หยุดเพลง|ปิดเพลง|stop music/i.test(t)) actions.push({ action: "STOP_MUSIC" });
  else if (/เปิดเพลง|เล่นเพลง|ขอเพลง|หาเพลง|play music/i.test(t)) actions.push({ action: "PLAY_MUSIC" });

  if (/(เปิด|ไป|เข้า).*(เพลง|เพลย์ลิสต์)/i.test(t)) actions.push({ action: "OPEN_MUSIC" });
  if (/(เปิด|ไป|เข้า).*(ไดอารี|ไดอารี่|อาหารวันนี้)/i.test(t)) actions.push({ action: "OPEN_DIARY" });
  if (/(เปิด|ไป|เข้า).*(สถิติ|สรุปวันนี้)/i.test(t)) actions.push({ action: "OPEN_STATS" });
  if (/(เปิด|ไป|เข้า).*(สแกน|กล้องอาหาร)/i.test(t)) actions.push({ action: "OPEN_SCAN" });
  if (/(เปิด|ไป|เข้า).*(บาร์โค้ด)/i.test(t)) actions.push({ action: "OPEN_BARCODE" });
  if (/(เปิด|ไป|เข้า).*(นับก้าว|pedometer)/i.test(t)) actions.push({ action: "OPEN_PEDOMETER" });
  if (/(เปิด|ไป|เข้า).*(ผู้ช่วย|แชท)/i.test(t)) actions.push({ action: "OPEN_ASSISTANT" });
  if (/(ตั้งโปรไฟล์|แก้โปรไฟล์|ข้อมูลส่วนตัว)/i.test(t)) actions.push({ action: "OPEN_PROFILE" });

  if (/หยุดเดิน|หยุดวิ่ง|หยุดปั่น|หยุดบันทึกเส้นทาง|หยุดออกกำลังกาย|พอแล้ว/i.test(t)) actions.push({ action: "STOP_GPS" });
  if (/เริ่มเดิน|ออกไปเดิน|เดินกัน|เริ่มวิ่ง|ออกไปวิ่ง|เริ่มปั่น|เริ่มออกกำลังกาย|เริ่มบันทึกเส้นทาง|ไปออกกำลังกัน/i.test(t)) {
    actions.push({ action: /วิ่ง/.test(t) ? "START_RUN" : /ปั่น/.test(t) ? "START_CYCLE" : "START_WALK" });
  }

  if (/กี่แคล|แคลอรี|แคลอรี่|พลังงานวันนี้/i.test(t)) actions.push({ action: "SHOW_CALORIES" });
  if (/กี่ก้าว|จำนวนก้าว|เดินไปกี่ก้าว/i.test(t)) actions.push({ action: "SHOW_STEPS" });
  return actions;
}

async function askIntent(text: string): Promise<VoiceAction[]> {
  const system = `คุณคือผู้เชี่ยวชาญภาษาไทยและเป็น intent router ของ WK Health
ตีความความหมายของผู้ใช้ภาษาไทยได้ทุกสำนวน พูดอ้อม พูดยาว พูดสั้น หรือมีคำฟุ่มเฟือยได้
ตอบ JSON array เท่านั้น ไม่มี markdown และใช้เฉพาะ action ที่อนุญาต

Allowed actions:
START_WALK,START_RUN,START_CYCLE,START_GPS,STOP_WALK,STOP_RUN,STOP_CYCLE,STOP_GPS,
PLAY_MUSIC,PAUSE_MUSIC,STOP_MUSIC,NEXT_MUSIC,PREVIOUS_MUSIC,
OPEN_MUSIC,OPEN_DIARY,OPEN_STATS,OPEN_SCAN,OPEN_BARCODE,OPEN_PEDOMETER,OPEN_ASSISTANT,OPEN_PROFILE,
EXERCISE,SHOW_CALORIES,SHOW_STEPS,SAVE_MEAL,NONE.`;
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: text }] }),
  });
  if (!response.ok) throw new Error("intent unavailable");
  const data = await response.json();
  const raw = String(data?.content ?? data?.choices?.[0]?.message?.content ?? "")
    .replace(/```json|```/g, "")
    .trim();
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.filter((item: any) => item && typeof item.action === "string") as VoiceAction[];
}

async function askThaiAssistant(text: string) {
  const system = `คุณคือผู้ช่วย WK Health
ตอบเป็นภาษาไทยเท่านั้น ใช้ภาษาพูดสุภาพ เป็นธรรมชาติ กระชับ และเข้าใจง่าย
อย่าอ้างว่าทำสิ่งใดสำเร็จถ้ายังไม่ได้ทำผ่าน action ของระบบ`;
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: text }] }),
  });
  if (!response.ok) throw new Error("assistant unavailable");
  const data = await response.json();
  return String(data?.content ?? data?.choices?.[0]?.message?.content ?? "รับทราบครับ").trim();
}

function chooseThaiVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => /^th[-_]/i.test(voice.lang))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("th"))
    ?? voices.find((voice) => /thai|ไทย/i.test(voice.name));
}

function emit(action: VoiceAction) {
  window.dispatchEvent(new CustomEvent("wk:voice-action", { detail: action }));
}

export function VoiceControlMobile({
  profileName,
  bodyWeightKg,
  onExercise,
  onStartGps,
  onStopGps,
  onOpenProfileModal,
}: VoiceControlProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [tts, setTts] = useState(() => typeof window === "undefined" ? true : localStorage.getItem(TTS_KEY) !== "0");
  const [voiceMode, setVoiceMode] = useState(() => typeof window === "undefined" ? false : localStorage.getItem(VOICE_MODE_KEY) === "1");
  const [micReady, setMicReady] = useState(false);

  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(voiceMode);
  const ttsRef = useRef(tts);
  const speakingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executeRef = useRef<(value: string) => Promise<void>>(async () => undefined);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { ttsRef.current = tts; }, [tts]);

  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try { recognitionRef.current?.abort?.(); } catch {}
    recognitionRef.current = null;
  }, []);

  const startRecognition = useCallback(() => {
    if (!voiceModeRef.current || speakingRef.current) return false;
    const SpeechRecognitionCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setStatus("error");
      setReply("โทรศัพท์หรือเบราว์เซอร์นี้ไม่รองรับการรู้จำเสียงบนเว็บครับ แนะนำ Chrome บน Android หรือ Safari รุ่นที่รองรับครับ");
      return false;
    }

    stopRecognition();
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "th-TH";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = String(event.results[index][0]?.transcript ?? "").trim();
        if (event.results[index].isFinal) finalText += `${transcript} `;
        else interim += transcript;
      }
      setText(finalText.trim() || interim.trim());
      if (finalText.trim()) void executeRef.current(finalText.trim());
    };
    recognition.onerror = (event: any) => {
      if (!voiceModeRef.current) return;
      if (event?.error === "not-allowed" || event?.error === "permission-denied") {
        setStatus("error");
        setReply("ไมโครโฟนถูกปฏิเสธครับ กรุณาเปิดสิทธิ์ Microphone ให้เว็บไซต์นี้ใน Settings ของโทรศัพท์แล้วลองใหม่");
        setVoiceMode(false);
        voiceModeRef.current = false;
        localStorage.setItem(VOICE_MODE_KEY, "0");
        return;
      }
      if (event?.error === "service-not-allowed") {
        setStatus("error");
        setReply("บริการรู้จำเสียงของเบราว์เซอร์ไม่พร้อมใช้งานครับ ลอง Chrome บน Android และเปิดเว็บผ่าน HTTPS");
        return;
      }
      if (event?.error !== "aborted" && !speakingRef.current) {
        setStatus("error");
        setReply("ยังจับเสียงไม่สำเร็จครับ ลองพูดใหม่อีกครั้ง");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (voiceModeRef.current && !speakingRef.current) {
        restartTimerRef.current = setTimeout(() => startRecognition(), 180);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      recognitionRef.current = null;
      return false;
    }
  }, [stopRecognition]);

  const ensureMicrophone = useCallback(async () => {
    if (!window.isSecureContext) {
      throw new Error("ระบบเสียงต้องเปิดผ่าน HTTPS จึงจะใช้งานไมโครโฟนบนโทรศัพท์ได้ครับ");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("เบราว์เซอร์นี้ไม่รองรับการขอสิทธิ์ไมโครโฟนครับ");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    setMicReady(true);
  }, []);

  const speakThai = useCallback((message: string) => {
    setReply(message);
    if (!ttsRef.current || !("speechSynthesis" in window)) {
      speakingRef.current = false;
      if (voiceModeRef.current) restartTimerRef.current = setTimeout(() => startRecognition(), 120);
      return;
    }

    speakingRef.current = true;
    stopRecognition();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "th-TH";
    utterance.rate = 0.93;
    utterance.pitch = 1;
    const thaiVoice = chooseThaiVoice();
    if (thaiVoice) utterance.voice = thaiVoice;

    const resumeListening = () => {
      speakingRef.current = false;
      if (voiceModeRef.current) restartTimerRef.current = setTimeout(() => startRecognition(), 180);
    };
    utterance.onend = resumeListening;
    utterance.onerror = resumeListening;
    window.speechSynthesis.speak(utterance);
  }, [startRecognition, stopRecognition]);

  const runActions = useCallback(async (actions: VoiceAction[], originalText: string) => {
    let completed = 0;
    for (const action of actions) {
      emit(action);
      switch (action.action) {
        case "OPEN_PROFILE":
          onOpenProfileModal();
          completed += 1;
          break;
        case "START_WALK":
        case "START_RUN":
        case "START_CYCLE":
        case "START_GPS":
          onStartGps();
          completed += 1;
          break;
        case "STOP_WALK":
        case "STOP_RUN":
        case "STOP_CYCLE":
        case "STOP_GPS":
          onStopGps();
          completed += 1;
          break;
        case "EXERCISE": {
          const mins = Math.max(1, Number(action.duration_min) || durationMin(originalText) || 20);
          const mets = Math.max(0.5, Number(action.mets) || 3.5);
          onExercise({ activity: String(action.activity || "ออกกำลังกาย"), duration_min: mins, mets, kcal: Math.round(mets * bodyWeightKg * mins / 60) });
          completed += 1;
          break;
        }
        case "PLAY_MUSIC":
        case "PAUSE_MUSIC":
        case "STOP_MUSIC":
        case "NEXT_MUSIC":
        case "PREVIOUS_MUSIC": {
          const map: Record<string, string> = { PLAY_MUSIC: "play", PAUSE_MUSIC: "pause", STOP_MUSIC: "stop", NEXT_MUSIC: "next", PREVIOUS_MUSIC: "prev" };
          window.dispatchEvent(new CustomEvent("wk:music", { detail: { action: map[action.action] } }));
          completed += 1;
          break;
        }
        case "SAVE_MEAL":
          window.dispatchEvent(new CustomEvent("wk:voice-save-meal"));
          completed += 1;
          break;
        case "SHOW_CALORIES":
        case "SHOW_STEPS":
          window.dispatchEvent(new CustomEvent("wk:voice-query", { detail: { action: action.action } }));
          completed += 1;
          break;
        default: {
          const route = ROUTES[action.action];
          if (route) {
            await navigate({ to: route as any });
            completed += 1;
          }
          break;
        }
      }
    }

    if (!completed || actions.every((item) => item.action === "NONE")) {
      try {
        setStatus("success");
        speakThai(await askThaiAssistant(originalText));
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
    const labelsToSay = actions.map((item) => labels[item.action]).filter(Boolean);
    setStatus("success");
    speakThai(labelsToSay.length ? `เรียบร้อยครับ ${labelsToSay.join(" และ ")}` : "รับทราบครับ");
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
        if (aiActions.some((item) => item.action !== "NONE")) actions = aiActions;
      } catch {
        // Local Thai parser is the offline fallback.
      }
      await runActions(actions.length ? actions : [{ action: "NONE" }], value);
    } catch {
      setStatus("error");
      speakThai("ขอโทษครับ ระบบขัดข้องชั่วคราว ลองพูดใหม่อีกครั้งได้เลย");
    }
  }, [runActions, speakThai]);

  useEffect(() => { executeRef.current = execute; }, [execute]);

  const startVoiceMode = useCallback(async () => {
    try {
      await ensureMicrophone();
      voiceModeRef.current = true;
      setVoiceMode(true);
      localStorage.setItem(VOICE_MODE_KEY, "1");
      setReply("พร้อมฟังครับ พูดภาษาไทยได้ตามธรรมชาติเลย");
      const started = startRecognition();
      if (!started) throw new Error("ไม่สามารถเริ่มตัวรู้จำเสียงได้ครับ");
    } catch (error) {
      voiceModeRef.current = false;
      setVoiceMode(false);
      localStorage.setItem(VOICE_MODE_KEY, "0");
      setStatus("error");
      setReply(error instanceof Error ? error.message : "เปิดไมโครโฟนไม่สำเร็จครับ");
    }
  }, [ensureMicrophone, startRecognition]);

  const stopVoiceMode = useCallback(() => {
    voiceModeRef.current = false;
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
      if (voiceModeRef.current) restartTimerRef.current = setTimeout(() => startRecognition(), 100);
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
  const micUnsupported = typeof window !== "undefined" && !(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition;

  return (
    <div className="vc-fixed-wrap">
      <div className="vc-bar glass" style={{ height: expanded ? 180 : 60 }}>
        <div className="vc-row">
          <button type="button" className={`vc-mic-btn ${voiceMode && status === "listening" ? "vc-breathe" : ""}`} onClick={() => (voiceMode ? stopVoiceMode() : void startVoiceMode())} aria-label={voiceMode ? "ปิดระบบเสียง" : "เปิดระบบเสียงภาษาไทย"}>
            {status === "processing" ? <Loader2 className="vc-icon vc-spin" /> : voiceMode ? <X className="vc-icon" /> : <Mic className="vc-icon" />}
            {voiceMode && status === "listening" && <span className="vc-ripple" />}
          </button>

          <div className="vc-status-text">
            <p>{status === "listening" ? "กำลังฟังภาษาไทย…" : status === "processing" ? "กำลังวิเคราะห์ความหมาย…" : status === "error" ? (reply || "เกิดข้อผิดพลาด") : reply || "กดไมค์เพื่อเริ่มคุยภาษาไทย"}</p>
            <p className="vc-subtext">{voiceMode ? "โหมดสนทนาเรียลไทม์ • AI ตอบเสร็จแล้วฟังต่ออัตโนมัติ" : profileName ? `WK • ${profileName}` : "WK HEALTH • VOICE"}</p>
          </div>

          <button onClick={toggleTts} className="press grid size-9 place-items-center rounded-xl" aria-label={tts ? "ปิดเสียง AI" : "เปิดเสียง AI"}>
            {tts ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>

        {expanded && (
          <div className="vc-body vc-rise-in">
            {status === "listening" && <div><div className="vc-waveform"><span className="vc-waveform-bar" style={{ height: "55%" }} /><span className="vc-waveform-bar" style={{ height: "90%" }} /><span className="vc-waveform-bar" style={{ height: "45%" }} /><span className="vc-waveform-bar" style={{ height: "75%" }} /><span className="vc-waveform-bar" style={{ height: "60%" }} /></div><div className="vc-transcript-box"><p>{text || "พูดได้ตามธรรมชาติ เช่น ‘เริ่มเดินแล้วเปิดเพลงให้ด้วย’"}<span className="vc-caret" /></p></div></div>}
            {status === "processing" && <div className="vc-processing"><Loader2 className="vc-icon-lg vc-spin vc-mint" /><p>กำลังเข้าใจภาษาไทยและทำตามคำสั่ง…</p></div>}
            {status === "success" && <div className="vc-result-card"><div className="vc-result-head"><div className="vc-result-icon"><Check className="vc-icon" /></div><div><p className="vc-result-label">พร้อมคุยต่อ</p><p className="vc-result-title">{reply || "ดำเนินการเรียบร้อยแล้ว"}</p></div></div></div>}
            {status === "error" && <div className="vc-error-box"><p className="flex items-start gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0" />{reply || "ลองพูดใหม่อีกครั้งครับ"}</p>{micUnsupported && <p className="mt-2 text-xs opacity-80">แนะนำ Chrome บน Android หรือเปิดเว็บผ่าน HTTPS</p>}</div>}
          </div>
        )}
      </div>
      {micReady && voiceMode && <span className="sr-only">Microphone permission granted</span>}
    </div>
  );
}

export default VoiceControlMobile;
