import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX, Loader2, Check, Music2, Navigation, MessageCircle } from "lucide-react";
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

const DEEPSEEK_ENDPOINT = "https://kasidathdeepseek.katodoohee.workers.dev";
const TTS_KEY = "wk_voice_tts_enabled";
const THAI_DIGITS: Record<string, string> = { ศูนย์:"0",หนึ่ง:"1",สอง:"2",สาม:"3",สี่:"4",ห้า:"5",หก:"6",เจ็ด:"7",แปด:"8",เก้า:"9",สิบ:"10",ยี่สิบ:"20",สามสิบ:"30",สี่สิบ:"40",ห้าสิบ:"50",หกสิบ:"60",เจ็ดสิบ:"70",แปดสิบ:"80",เก้าสิบ:"90" };

function normalizeThai(text: string) {
  let out = text.trim();
  for (const [word, digit] of Object.entries(THAI_DIGITS).sort((a,b) => b[0].length-a[0].length)) out = out.split(word).join(digit);
  return out;
}
function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "th-TH";
  u.rate = 1;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}
function durationMin(text: string) {
  const t = normalizeThai(text);
  const h = t.match(/(\d+(?:\.\d+)?)\s*ชั่วโมง/); if (h) return Number(h[1])*60;
  const m = t.match(/(\d+(?:\.\d+)?)\s*นาที/); if (m) return Number(m[1]);
  const s = t.match(/(\d+(?:\.\d+)?)\s*วินาที/); if (s) return Number(s[1])/60;
  return null;
}
const LOCAL_METS = [
  { keys:["วิ่ง"], activity:"วิ่ง", mets:8 },
  { keys:["เดิน"], activity:"เดิน", mets:3.5 },
  { keys:["ปั่นจักรยาน","จักรยาน"], activity:"ปั่นจักรยาน", mets:6 },
  { keys:["ว่ายน้ำ"], activity:"ว่ายน้ำ", mets:7 },
  { keys:["โยคะ"], activity:"โยคะ", mets:2.5 },
  { keys:["เวท","ยกน้ำหนัก"], activity:"ยกน้ำหนัก", mets:5 },
];
function localExercise(text: string) {
  for (const x of LOCAL_METS) if (x.keys.some(k => text.includes(k))) return x;
  return null;
}

async function classifyExercise(text: string) {
  const system = `คุณเป็นตัวแปลคำสั่งเสียงของ WK Health ภาษาไทย ตอบ JSON เท่านั้น\nรูปแบบ: {"intent":"exercise","activity":"...","duration_min":20,"mets":3.5} หรือ {"intent":"start_gps"} หรือ {"intent":"stop_gps"} หรือ {"intent":"none"}. ถ้าเป็นกิจกรรมออกกำลังกายให้ประเมิน METs ตามความหนักที่พูดถึงและแปลงเวลาเป็นนาที`;
  const r = await fetch(DEEPSEEK_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[{role:"system",content:system},{role:"user",content:normalizeThai(text)}]})});
  if (!r.ok) throw new Error("voice classifier unavailable");
  const d = await r.json();
  const raw = String(d?.content ?? d?.choices?.[0]?.message?.content ?? "").replace(/```json|```/g,"").trim();
  return JSON.parse(raw);
}

function musicCommand(text: string): "play"|"pause"|"next"|"prev"|"stop"|null {
  const t = text.toLowerCase();
  if (/(เพลงถัดไป|เพลงต่อไป|เพลงหน้า|next)/.test(t)) return "next";
  if (/(เพลงก่อน|ย้อนเพลง|previous)/.test(t)) return "prev";
  if (/(หยุดเพลง|ปิดเพลง|stop music)/.test(t)) return "stop";
  if (/(พักเพลง|หยุดชั่วคราว|pause)/.test(t)) return "pause";
  if (/(เปิดเพลง|เล่นเพลง|เพลงต่อ|play music)/.test(t)) return "play";
  return null;
}
function routeCommand(text: string): string | null {
  if (/(เปิด|ไป|เข้า).*(เพลง|เพลย์ลิสต์)/.test(text)) return "/music";
  if (/(เปิด|ไป|เข้า).*(ไดอารี|ไดอารี่)/.test(text)) return "/diary";
  if (/(เปิด|ไป|เข้า).*(สถิติ|สรุปวันนี้)/.test(text)) return "/stats";
  if (/(เปิด|ไป|เข้า).*(สแกน|กล้องอาหาร)/.test(text)) return "/scan";
  if (/(เปิด|ไป|เข้า).*(บาร์โค้ด)/.test(text)) return "/barcode";
  if (/(เปิด|ไป|เข้า).*(ผู้ช่วย|แชท)/.test(text)) return "/assistant";
  if (/(เปิด|ไป|เข้า).*(นับก้าว|pedometer)/i.test(text)) return "/pedometer";
  return null;
}

export function VoiceControl({ profileName, bodyWeightKg, onExercise, onStartGps, onStopGps, onOpenProfileModal }: VoiceControlProps) {
  const navigate = useNavigate();
  const [status,setStatus] = useState<Status>("idle");
  const [text,setText] = useState("");
  const [reply,setReply] = useState("");
  const [tts,setTts] = useState(() => typeof window === "undefined" ? true : localStorage.getItem(TTS_KEY) !== "0");
  const recognitionRef = useRef<any>(null);

  const say = useCallback((message:string) => { setReply(message); speak(message,tts); },[tts]);

  useEffect(() => () => { recognitionRef.current?.stop?.(); },[]);

  const execute = useCallback(async (raw:string) => {
    const value = raw.trim(); if (!value) return;
    setText(value); setStatus("processing");
    const music = musicCommand(value);
    if (music) {
      window.dispatchEvent(new CustomEvent("wk:music",{detail:{action:music}}));
      setStatus("success");
      say(music === "next" ? "เปลี่ยนเป็นเพลงถัดไปแล้วครับ" : music === "prev" ? "ย้อนกลับเพลงก่อนหน้าแล้วครับ" : music === "stop" ? "ปิดเพลงแล้วครับ" : music === "pause" ? "พักเพลงแล้วครับ" : "เปิดเพลงให้แล้วครับ");
      return;
    }
    const route = routeCommand(value);
    if (route) {
      await navigate({to:route as any});
      setStatus("success");
      say(route === "/music" ? "เปิดเพลย์ลิสต์ให้แล้วครับ" : route === "/pedometer" ? "เปิดระบบนับก้าวให้แล้วครับ" : "เปิดหน้าให้แล้วครับ");
      return;
    }
    if (/(ตั้งโปรไฟล์|แก้โปรไฟล์|ข้อมูลส่วนตัว)/.test(value)) { onOpenProfileModal(); setStatus("success"); say("เปิดการตั้งค่าโปรไฟล์ให้แล้วครับ"); return; }
    const gpsStart = /(เริ่มเดิน|เริ่มวิ่ง|เริ่มปั่น|เริ่มบันทึกเส้นทาง|เริ่มออกกำลังกาย)/.test(value);
    const gpsStop = /(หยุดเดิน|หยุดวิ่ง|หยุดปั่น|หยุดบันทึกเส้นทาง|หยุดออกกำลังกาย)/.test(value);
    if (gpsStart) { onStartGps(); setStatus("success"); say("เริ่มติดตาม GPS แล้วครับ"); return; }
    if (gpsStop) { onStopGps(); setStatus("success"); say("หยุดและบันทึกเส้นทางแล้วครับ"); return; }

    try {
      const parsed = await classifyExercise(value);
      if (parsed.intent === "start_gps") { onStartGps(); setStatus("success"); say("เริ่มติดตาม GPS แล้วครับ"); return; }
      if (parsed.intent === "stop_gps") { onStopGps(); setStatus("success"); say("หยุดและบันทึกเส้นทางแล้วครับ"); return; }
      if (parsed.intent === "exercise") {
        const mins = Number(parsed.duration_min) || durationMin(value) || 20;
        const mets = Math.max(0.5,Number(parsed.mets)||3.5);
        const result = { activity:String(parsed.activity||"ออกกำลังกาย"), duration_min:mins, mets, kcal:Math.round(mets*bodyWeightKg*(mins/60)) };
        onExercise(result); setStatus("success"); say(`คำนวณให้แล้วครับ ${result.activity} ${Math.round(mins)} นาที ประมาณ ${result.kcal} กิโลแคลอรี`); return;
      }
    } catch { /* local fallback / normal chat below */ }

    const local = localExercise(normalizeThai(value));
    if (local) {
      const mins = durationMin(value) || 20;
      const kcal = Math.round(local.mets*bodyWeightKg*(mins/60));
      onExercise({activity:local.activity,duration_min:mins,mets:local.mets,kcal});
      setStatus("success"); say(`บันทึกกิจกรรม ${local.activity} ${Math.round(mins)} นาที ประมาณ ${kcal} กิโลแคลอรีแล้วครับ`); return;
    }

    try {
      const answer = await apiAssistantChat(value);
      setStatus("success"); say(answer.text || "รับทราบครับ");
    } catch {
      setStatus("error"); say("ตอนนี้ผมเชื่อมต่อผู้ช่วย AI ไม่ได้ ลองใหม่อีกครั้งครับ");
    }
  },[bodyWeightKg,navigate,onExercise,onOpenProfileModal,onStartGps,onStopGps,say]);

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus("error"); say("เบราว์เซอร์นี้ไม่รองรับการรับเสียงครับ"); return; }
    recognitionRef.current?.stop?.();
    const r = new SR();
    r.lang = "th-TH"; r.continuous = false; r.interimResults = true;
    r.onstart = () => { setStatus("listening"); setText(""); setReply(""); };
    r.onresult = (e:any) => {
      let finalText="", interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){ const s=e.results[i][0].transcript; if(e.results[i].isFinal) finalText += s; else interim += s; }
      setText(finalText||interim);
      if(finalText) void execute(finalText);
    };
    r.onerror = () => { setStatus("error"); say("ไม่ได้ยินเสียงครับ ลองกดไมค์แล้วพูดใหม่อีกครั้ง"); };
    r.onend = () => { if(status === "listening") setStatus("idle"); };
    recognitionRef.current = r;
    try { r.start(); } catch { setStatus("error"); }
  };

  const toggleTts = () => { const next=!tts; setTts(next); localStorage.setItem(TTS_KEY,next?"1":"0"); if(!next) window.speechSynthesis?.cancel(); };

  return (
    <div className="vc-fixed-wrap">
      <div className="vc-bar glass" style={{height: status === "idle" ? 60 : 172}}>
        <div className="vc-row">
          <button className={`vc-mic-btn ${status === "listening" ? "vc-breathe" : ""}`} onClick={startListening} aria-label="เปิดไมค์สั่งงานด้วยเสียง">
            {status === "processing" ? <Loader2 className="vc-icon vc-spin"/> : <Mic className="vc-icon"/>}
            {status === "listening" && <span className="vc-ripple"/>}
          </button>
          <div className="vc-status-text">
            <p>{status === "listening" ? "กำลังฟังภาษาไทย…" : status === "processing" ? "กำลังประมวลผล…" : status === "error" ? "เกิดข้อผิดพลาด" : reply || "กดไมค์แล้วพูดได้เลย"}</p>
            <p className="vc-subtext">{profileName ? `WK • ${profileName}` : "WK HEALTH • VOICE"}</p>
          </div>
          <button onClick={toggleTts} className="press grid size-9 place-items-center rounded-xl" aria-label={tts ? "ปิดเสียงตอบกลับ" : "เปิดเสียงตอบกลับ"}>{tts ? <Volume2 className="size-4"/> : <VolumeX className="size-4"/>}</button>
        </div>
        {status !== "idle" && <div className="vc-body vc-rise-in">
          {status === "listening" && <div><div className="vc-waveform"><span className="vc-waveform-bar" style={{height:"55%"}}/><span className="vc-waveform-bar" style={{height:"90%"}}/><span className="vc-waveform-bar" style={{height:"45%"}}/><span className="vc-waveform-bar" style={{height:"75%"}}/><span className="vc-waveform-bar" style={{height:"60%"}}/></div><div className="vc-transcript-box"><p>{text || "พูดคำสั่ง เช่น ‘เริ่มเดิน’, ‘เปิดเพลง’, ‘วันนี้กินไปเท่าไร’"}<span className="vc-caret"/></p></div></div>}
          {status === "processing" && <div className="vc-processing"><Loader2 className="vc-icon-lg vc-spin vc-mint"/><p>กำลังเข้าใจคำสั่งและตอบกลับ…</p></div>}
          {status === "success" && <div className="vc-result-card"><div className="vc-result-head"><div className="vc-result-icon"><Check className="vc-icon"/></div><div><p className="vc-result-label">สำเร็จ</p><p className="vc-result-title">{reply || "ดำเนินการเรียบร้อยแล้ว"}</p></div></div></div>}
          {status === "error" && <div className="vc-error-box"><p>{reply || "ลองกดไมค์ใหม่อีกครั้งครับ"}</p></div>}
        </div>}
      </div>
    </div>
  );
}
