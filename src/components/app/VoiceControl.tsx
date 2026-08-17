import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, Check, Flame, Timer, Footprints, AlertTriangle } from "lucide-react";
import "./voice-control.css";

/**
 * VoiceControl — แถบสั่งงานด้วยเสียงลอยด้านบน
 * ดึง UI มาจาก Lovable แล้วต่อ logic จริงเข้ากับระบบเดิมที่มีอยู่แล้วใน wk-health-frontend
 *
 * วิธีใช้:
 *   <VoiceControl
 *     profileName={profileName}
 *     bodyWeightKg={bodyWeightKg}
 *     onExercise={(result) => { ...บันทึกลง state/DB... }}
 *     onStartGps={() => { ...เริ่ม GPS tracking... }}
 *     onStopGps={() => { ...หยุด GPS tracking... }}
 *     onOpenProfileModal={() => { ...เด้ง modal กรอกชื่อ... }}
 *   />
 */

const DEEPSEEK_ENDPOINT = "https://kasidathdeepseek.katodoohee.workers.dev";

type Status = "idle" | "listening" | "processing" | "success" | "error";

type ExerciseResult = {
  activity: string;
  duration_min: number;
  mets: number;
  kcal: number;
};

type VoiceControlProps = {
  profileName: string | null | undefined;
  bodyWeightKg: number;
  onExercise: (result: ExerciseResult) => void;
  onStartGps: () => void;
  onStopGps: () => void;
  onOpenProfileModal: () => void;
};

// ---------- helpers ----------

const THAI_DIGIT_WORDS: Record<string, string> = {
  ศูนย์: "0", หนึ่ง: "1", สอง: "2", สาม: "3", สี่: "4",
  ห้า: "5", หก: "6", เจ็ด: "7", แปด: "8", เก้า: "9",
  สิบ: "10", ยี่สิบ: "20", สามสิบ: "30", สี่สิบ: "40",
  ห้าสิบ: "50", หกสิบ: "60", เจ็ดสิบ: "70", แปดสิบ: "80", เก้าสิบ: "90",
};

function thaiWordsToDigits(text: string): string {
  let out = text;
  // ลำดับยาว -> สั้น กันตัดคำผิด
  const entries = Object.entries(THAI_DIGIT_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, digit] of entries) {
    out = out.split(word).join(digit);
  }
  return out;
}

const GPS_START_KEYWORDS = ["เริ่มวิ่ง", "เริ่มเดิน", "เริ่มปั่น", "เริ่มออกกำลังกาย", "เริ่มบันทึกเส้นทาง"];
const GPS_STOP_KEYWORDS = ["หยุดวิ่ง", "หยุดเดิน", "จบการวิ่ง", "จบการเดิน", "หยุดบันทึกเส้นทาง", "หยุดออกกำลังกาย"];

function matchGpsKeyword(text: string): "start" | "stop" | null {
  if (GPS_START_KEYWORDS.some((k) => text.includes(k))) return "start";
  if (GPS_STOP_KEYWORDS.some((k) => text.includes(k))) return "stop";
  return null;
}

// fallback METs table แบบง่าย เผื่อ DeepSeek ล่ม
const LOCAL_ACTIVITY_METS: { keywords: string[]; activity: string; mets: number }[] = [
  { keywords: ["วิ่ง"], activity: "วิ่ง", mets: 8 },
  { keywords: ["เดิน"], activity: "เดิน", mets: 3.5 },
  { keywords: ["ปั่นจักรยาน", "ปั่นจักรยาน"], activity: "ปั่นจักรยาน", mets: 6 },
  { keywords: ["ว่ายน้ำ"], activity: "ว่ายน้ำ", mets: 7 },
  { keywords: ["โยคะ"], activity: "โยคะ", mets: 2.5 },
  { keywords: ["เวท", "ยกน้ำหนัก"], activity: "ยกน้ำหนัก", mets: 5 },
];

function localActivityMatchAnyAlt(alternatives: string[]): { activity: string; mets: number } | null {
  for (const alt of alternatives) {
    for (const entry of LOCAL_ACTIVITY_METS) {
      if (entry.keywords.some((k) => alt.includes(k))) {
        return { activity: entry.activity, mets: entry.mets };
      }
    }
  }
  return null;
}

function extractDurationMin(text: string): number | null {
  const digitText = thaiWordsToDigits(text);
  const hourMatch = digitText.match(/(\d+(?:\.\d+)?)\s*ชั่วโมง/);
  if (hourMatch) return parseFloat(hourMatch[1] ?? "0") * 60;
  const minMatch = digitText.match(/(\d+(?:\.\d+)?)\s*นาที/);
  if (minMatch) return parseFloat(minMatch[1] ?? "0");
  const secMatch = digitText.match(/(\d+(?:\.\d+)?)\s*วินาที/);
  if (secMatch) return parseFloat(secMatch[1] ?? "0") / 60;
  return null;
}

async function callDeepSeek(text: string): Promise<
  | { intent: "exercise"; activity: string; duration_min: number; mets: number }
  | { intent: "start_gps" | "stop_gps" | "none" }
> {
  const systemPrompt = `คุณคือระบบตีความคำสั่งเสียงสำหรับแอพสุขภาพภาษาไทย
ให้ตีความข้อความผู้ใช้เป็น 1 ใน 3 อย่างเท่านั้น แล้วตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นปน:
1. {"intent":"exercise","activity":"<ชื่อกิจกรรม>","duration_min":<ตัวเลขนาที>,"mets":<ค่า METs ตาม Compendium of Physical Activities>}
2. {"intent":"start_gps"} หรือ {"intent":"stop_gps"}
3. {"intent":"none"}

กติกา:
- แปลงหน่วยเวลาทุกแบบ (วินาที/นาที/ชั่วโมง) เป็น duration_min เสมอ
- ถ้าฟังดูน่าจะเป็นกิจกรรมออกกำลังกาย ให้เดาแบบมีเหตุผล ดีกว่าตอบ none
- ประเมิน mets ตาม Compendium of Physical Activities ให้สมเหตุสมผลกับกิจกรรมและความหนักที่พูดถึง`;

  const res = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: thaiWordsToDigits(text) },
      ],
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek proxy error: ${res.status}`);
  const data = await res.json();
  const raw: string = data?.content ?? data?.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return parsed;
}

// ---------- component ----------

function Waveform({ active }: { active: boolean }) {
  const [bars, setBars] = useState<number[]>(() => Array(28).fill(0.18));

  useEffect(() => {
    if (!active) {
      setBars(Array(28).fill(0.14));
      return;
    }
    const id = setInterval(() => {
      setBars(
        Array.from({ length: 28 }, (_, i) => {
          const center = 1 - Math.abs(i - 13.5) / 16;
          return 0.14 + Math.random() * 0.86 * center;
        }),
      );
    }, 120);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div className="vc-waveform" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="vc-waveform-bar"
          style={{ height: `${Math.round(h * 100)}%`, opacity: active ? 0.95 : 0.3 }}
        />
      ))}
    </div>
  );
}

const BAR_HEIGHT: Record<Status, number> = {
  idle: 60,
  listening: 244,
  processing: 172,
  success: 196,
  error: 96,
};

export function VoiceControl({
  profileName,
  bodyWeightKg,
  onExercise,
  onStartGps,
  onStopGps,
  onOpenProfileModal,
}: VoiceControlProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [words, setWords] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("ไม่ได้ยินเสียง ลองพูดอีกครั้ง");
  const [result, setResult] = useState<ExerciseResult | null>(null);

  const recognitionRef = useRef<any>(null);
  const bufferRef = useRef<string[]>([]);
  const alternativesRef = useRef<string[]>([]);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCountRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const scheduleIdle = useCallback((ms: number) => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      setStatus("idle");
      setWords([]);
      setResult(null);
    }, ms);
  }, [clearIdleTimer]);

  const raiseError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setStatus("error");
    scheduleIdle(3000);
  }, [scheduleIdle]);

  const processTranscript = useCallback(
    async (fullText: string, allAlternatives: string[]) => {
      setStatus("processing");

      // 1. เช็ค GPS keyword ก่อน AI เสมอ
      const gps = matchGpsKeyword(fullText);
      if (gps === "start") {
        onStartGps();
        setStatus("success");
        setResult(null);
        scheduleIdle(2500);
        return;
      }
      if (gps === "stop") {
        onStopGps();
        setStatus("success");
        setResult(null);
        scheduleIdle(2500);
        return;
      }

      // 2. ยิง DeepSeek
      try {
        const parsed = await callDeepSeek(fullText);
        if (parsed.intent === "start_gps") {
          onStartGps();
          setStatus("success");
          scheduleIdle(2500);
          return;
        }
        if (parsed.intent === "stop_gps") {
          onStopGps();
          setStatus("success");
          scheduleIdle(2500);
          return;
        }
        if (parsed.intent === "exercise") {
          const kcal = Math.round(parsed.mets * bodyWeightKg * (parsed.duration_min / 60));
          const finalResult: ExerciseResult = {
            activity: parsed.activity,
            duration_min: parsed.duration_min,
            mets: parsed.mets,
            kcal,
          };
          onExercise(finalResult);
          setResult(finalResult);
          setStatus("success");
          scheduleIdle(4000);
          return;
        }
        // intent === "none" -> fallback local match ต่อ
        throw new Error("none");
      } catch {
        // 3. Fallback: จับคำในเครื่อง ไล่เช็คทุก alternative
        const local = localActivityMatchAnyAlt(allAlternatives.length ? allAlternatives : [fullText]);
        const duration = extractDurationMin(fullText) ?? 20;
        if (local) {
          const kcal = Math.round(local.mets * bodyWeightKg * (duration / 60));
          const finalResult: ExerciseResult = {
            activity: local.activity,
            duration_min: duration,
            mets: local.mets,
            kcal,
          };
          onExercise(finalResult);
          setResult(finalResult);
          setStatus("success");
          scheduleIdle(4000);
        } else {
          raiseError("ไม่เข้าใจคำสั่ง ลองพูดใหม่อีกครั้ง");
        }
      }
    },
    [bodyWeightKg, onExercise, onStartGps, onStopGps, raiseError, scheduleIdle],
  );

  const flushBuffer = useCallback(() => {
    const fullText = bufferRef.current.join(" ").trim();
    const alts = [...alternativesRef.current];
    bufferRef.current = [];
    alternativesRef.current = [];
    if (fullText) {
      void processTranscript(fullText, alts);
    } else {
      setStatus("idle");
    }
  }, [processTranscript]);

  const setupRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      raiseError("เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง");
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "th-TH";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) {
          silenceCountRef.current = 0;
          bufferRef.current.push(transcript);
          for (let a = 0; a < Math.min(res.length, 3); a++) {
            alternativesRef.current.push(res[a].transcript);
          }
          setWords((prev) => [...prev, ...transcript.trim().split(/\s+/)]);

          if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
          bufferTimerRef.current = setTimeout(() => {
            recognition.stop();
            flushBuffer();
          }, 3000);
        } else {
          interim = transcript;
        }
      }
      if (interim) {
        setWords((prev) => {
          const base = prev.filter((_, i) => i < prev.length); // no-op keeps type happy
          return base;
        });
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        raiseError("ไม่มีสิทธิ์เข้าถึงไมโครโฟน");
      } else if (event.error === "no-speech") {
        silenceCountRef.current += 1;
        if (silenceCountRef.current >= 4) {
          raiseError("ไม่ได้ยินเสียงเลย ลองใหม่อีกครั้ง");
          silenceCountRef.current = 0;
        }
      } else if (event.error === "audio-capture") {
        raiseError("ไม่พบไมโครโฟนในอุปกรณ์นี้");
      } else if (event.error === "network") {
        raiseError("การเชื่อมต่อเครือข่ายมีปัญหา");
      }
    };

    recognition.onend = async () => {
      if (status !== "listening") return;
      try {
        const perm = await (navigator as any).permissions?.query?.({ name: "microphone" as any });
        if (!perm || perm.state === "granted") {
          recognition.start();
        }
      } catch {
        recognition.start();
      }
    };

    return recognition;
  }, [flushBuffer, raiseError, status]);

  const startListening = useCallback(() => {
    if (!profileName) {
      onOpenProfileModal();
      return;
    }
    setWords([]);
    setResult(null);
    setStatus("listening");
    const recognition = setupRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      raiseError("ไม่สามารถเริ่มไมโครโฟนได้");
    }
  }, [onOpenProfileModal, profileName, raiseError, setupRecognition]);

  const stopListening = useCallback(() => {
    clearIdleTimer();
    if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    recognitionRef.current?.stop?.();
    flushBuffer();
  }, [clearIdleTimer, flushBuffer]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
      clearIdleTimer();
    };
  }, [clearIdleTimer]);

  const listening = status === "listening";
  const expanded = status !== "idle";

  return (
    <div className="vc-fixed-wrap">
      <div
        className="vc-bar glass"
        style={{ height: BAR_HEIGHT[status] }}
      >
        <div className="vc-row">
          <button
            type="button"
            onClick={() => (expanded ? stopListening() : startListening())}
            aria-label={expanded ? "ปิดแถบเสียง" : "แตะเพื่อสั่งงานด้วยเสียง"}
            className={`vc-mic-btn ${listening ? "vc-breathe" : ""}`}
          >
            {listening &&
              [0, 0.8].map((d) => (
                <span key={d} className="vc-ripple" style={{ animationDelay: `${d}s` }} />
              ))}
            {status === "processing" ? (
              <Loader2 className="vc-icon vc-spin" />
            ) : status === "success" ? (
              <Check className="vc-icon vc-pop" />
            ) : status === "error" ? (
              <AlertTriangle className="vc-icon" />
            ) : (
              <Mic className="vc-icon" />
            )}
          </button>

          <div className="vc-status-text">
            <p className={status === "error" ? "vc-error-text" : ""}>
              {status === "idle" && "แตะเพื่อสั่งงานด้วยเสียง"}
              {status === "listening" && "กำลังฟัง…"}
              {status === "processing" && "กำลังวิเคราะห์"}
              {status === "success" && "บันทึกสำเร็จ"}
              {status === "error" && errorMsg}
            </p>
            {expanded && status !== "error" && <p className="vc-subtext">voice engine</p>}
          </div>

          <span className={`vc-dot vc-dot-${status}`} />
        </div>

        <div className="vc-body">
          {status === "listening" && (
            <div className="vc-rise-in">
              <Waveform active />
              <div className="vc-transcript-box">
                <p>
                  {words.length === 0 ? (
                    <span className="vc-placeholder">รอรับเสียงของคุณ…</span>
                  ) : (
                    words.map((w, i) => (
                      <span key={`${w}-${i}`} className="vc-word">
                        {w}
                      </span>
                    ))
                  )}
                  <span className="vc-caret" />
                </p>
              </div>
              <div className="vc-stop-wrap">
                <button
                  onClick={stopListening}
                  aria-label="หยุดฟัง"
                  className="vc-stop-btn"
                >
                  <span className="vc-ripple" />
                  <Mic className="vc-icon-lg" />
                </button>
              </div>
            </div>
          )}

          {status === "success" && result && (
            <div className="vc-rise-in vc-result-card">
              <div className="vc-result-head">
                <div className="vc-result-icon">
                  <Footprints className="vc-icon" />
                </div>
                <div>
                  <p className="vc-result-label">บันทึกกิจกรรม</p>
                  <p className="vc-result-title">{result.activity}</p>
                </div>
              </div>
              <div className="vc-result-grid">
                <div className="glass vc-result-stat">
                  <Timer className="vc-icon-sm vc-aqua" />
                  <span>{result.duration_min} นาที</span>
                </div>
                <div className="glass vc-result-stat">
                  <Flame className="vc-icon-sm vc-mint" />
                  <span>{result.kcal} kcal</span>
                </div>
              </div>
            </div>
          )}

          {status === "processing" && (
            <div className="vc-rise-in vc-processing">
              <Loader2 className="vc-icon-lg vc-spin vc-aqua" />
              <p>กำลังวิเคราะห์คำสั่งของคุณ</p>
              <span className="vc-dots">
                {[0, 0.15, 0.3].map((d) => (
                  <span key={d} style={{ animationDelay: `${d}s` }} />
                ))}
              </span>
            </div>
          )}

          {status === "error" && (
            <div className="vc-rise-in vc-error-box">
              <p>ตรวจสอบไมโครโฟนแล้วลองใหม่อีกครั้ง</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceControl;
