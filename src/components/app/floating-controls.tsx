import { useState } from "react";
import { Music2, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { apiMe } from "@/lib/api";
import { gpsBridge } from "@/lib/gps-bridge";
import { useMusic } from "@/lib/music";
import { MiniPlayer, VolumeControl } from "@/components/app/mini-player";
import VoiceControl from "@/components/VoiceControl";
import "@/components/voice-control.css";

export function FloatingControls() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { current } = useMusic();
  const [musicOpen, setMusicOpen] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: apiMe, enabled: isAuthenticated });

  if (!isAuthenticated) return null;

  return (
    <>
      {/* FIX: บั๊กใหญ่ 🔴 — เดิมมีปุ่มไมค์ลอย 2 ชั้นซ้อนกัน: ปุ่มนอก (FAB ตรงนี้) แค่เปิด/ปิด "แผง"
          แล้วปุ่มไมค์จริงที่เริ่มฟังเสียง (อยู่ใน VoiceControl) ถึงจะโผล่มาให้กดอีกทีข้างใน
          ผู้ใช้กดปุ่มไมค์รอบแรกคาดว่าจะเริ่มพูดได้เลย แต่จริงๆ แค่เปิดแผงเปล่าๆ ต้องกดซ้ำอีกครั้ง
          — ตัด wrapper/voiceOpen ออก ให้ VoiceControl (ซึ่งเป็นปุ่มเปิด/ปิดในตัวเองอยู่แล้ว) render ตรงๆ
          กดครั้งเดียวเริ่มฟังทันที ไม่ต้องเปิดแผงก่อน */}
      <VoiceControl
        profileName={me.data?.["name"] as string | undefined}
        bodyWeightKg={Number(me.data?.["weightKg"] ?? 60)}
        onExercise={(result) => console.log("[VoiceControl] exercise result:", result)}
        onStartGps={async () => {
          const ok = await gpsBridge.start();
          if (!ok) void navigate({ to: "/pedometer" });
        }}
        onStopGps={async () => {
          await gpsBridge.stop();
        }}
        onOpenProfileModal={() => void navigate({ to: "/profile" })}
      />

      {/* ปุ่มควบคุมระดับเสียงกลางของทั้งระบบ (เพลง/YouTube) — แสดงตลอดเวลาไม่ว่าจะกำลังเล่นเพลงอยู่หรือไม่
          ก่อนหน้านี้ VolumeControl อยู่ใน MiniPlayer เท่านั้น ซึ่งซ่อนทั้งหมดเมื่อไม่มีเพลงเล่นอยู่ (current === null)
          ทำให้กดปรับเสียงไม่ได้เลยถ้ายังไม่เริ่มเล่นเพลง จึงย้ายมาไว้เป็นปุ่มลอยแยกที่เห็น/ใช้ได้เสมอ */}
      <div className="wk-floating-volume" aria-label="ระดับเสียงระบบ">
        <VolumeControl variant="fab" />
      </div>

      {current && (
        <div className="wk-floating-music" aria-label="Mini music player">
          {!musicOpen ? (
            <button
              type="button"
              aria-label="เปิดเครื่องเล่นเพลง"
              aria-expanded={false}
              onClick={() => setMusicOpen(true)}
              className="wk-floating-music-fab"
            >
              <Music2 className="size-5" aria-hidden="true" />
              <span className="wk-floating-track">{current.title}</span>
            </button>
          ) : (
            <div className="wk-floating-panel wk-floating-music-panel">
              <button
                type="button"
                aria-label="ย่อเครื่องเล่นเพลง"
                onClick={() => setMusicOpen(false)}
                className="wk-floating-close"
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
              <MiniPlayer />
            </div>
          )}
        </div>
      )}
    </>
  );
}
