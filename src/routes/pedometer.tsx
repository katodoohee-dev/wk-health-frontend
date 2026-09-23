import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { Dumbbell, Flame, Footprints, Loader2, MapPin, Mountain, Play, Plus, Route as RouteIcon, Share2, Square, Timer, X, Image as ImageIcon, Check } from "lucide-react";
import { PageHeader, GlassCard, Ring, SectionTitle } from "@/components/app/ui-bits";
import { ErrorState, LoadingState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { gpsBridge } from "@/lib/gps-bridge";
import { apiFriendLocations, apiFriendLocationSharingStatus, apiFriendsList } from "@/lib/api-new-features";
import { startFriendLocationSharing, stopFriendLocationSharing } from "@/lib/friend-location";
import type { GeoResult } from "@/lib/geo";
import { haversineKm, estimateKcalBurnedClient } from "@/lib/geo";
import { enqueuePendingRoute, flushPendingRoutes, getPendingRoutes } from "@/lib/route-offline-queue";
import { LiveTrackMap } from "@/components/LiveTrackMap";
import { Link } from "@tanstack/react-router";
import {
  apiPedometerLog,
  apiPedometerToday,
  apiRouteDetail,
  apiRouteHistory,
  apiRouteStart,
  apiRouteStop,
  type GeoPoint,
} from "@/lib/api";
// FIX: เพิ่มใหม่ — ตามที่ขอ "แชร์สถิติการวิ่งพร้อมเส้นทาง" เลือกสีเส้น/พื้นหลังเองได้
import { renderRunSharePreview, loadImageFromFile } from "@/lib/share-run-image";
import { shareOrDownloadImage } from "@/lib/share-image";

export const Route = createFileRoute("/pedometer")({
  head: () => ({
    meta: [
      { title: "นับก้าวเดิน — Weeker" },
      { name: "description", content: "ติดตามจำนวนก้าว ระยะทาง แคลอรีที่เผาผลาญ และนาทีแอคทีฟในแต่ละวัน" },
      { property: "og:title", content: "นับก้าวเดิน — Weeker" },
      { property: "og:description", content: "ติดตามก้าวเดิน ระยะทาง และแคลอรีที่เผาผลาญ" },
    ],
  }),
  component: PedometerPage,
});

function PedometerPage() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [steps, setSteps] = useState(1000);

  const q = useQuery({
    queryKey: ["pedometer", "today"],
    queryFn: apiPedometerToday,
    enabled: isAuthenticated,
  });

  const log = useMutation({
    mutationFn: (n: number) => apiPedometerLog(n),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pedometer"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  // FIX: ป้องกัน crash/loading ค้างตลอดกาลเมื่อยังไม่ล็อกอิน (query ถูก disable แต่โค้ดเดิมใช้ q.data! แบบไม่กันเคส undefined)
  if (!isAuthenticated) {
    return (
      <div className="rise-in">
        <PageHeader title="Pedometer" subtitle="ก้าวเล็ก ๆ ทุกวัน" />
        <GlassCard className="p-6 text-center text-sm text-muted-foreground">
          กรุณาเข้าสู่ระบบก่อนใช้งานหน้านี้
        </GlassCard>
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="rise-in">
        <PageHeader title="Pedometer" subtitle="ก้าวเล็ก ๆ ทุกวัน" />
        <LoadingState label="กำลังโหลดข้อมูลก้าวเดิน…" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="rise-in">
        <PageHeader title="Pedometer" subtitle="ก้าวเล็ก ๆ ทุกวัน" />
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const p = q.data;
  const pct = p.goal ? Math.round((p.steps / p.goal) * 100) : 0;

  return (
    <div className="rise-in">
      <PageHeader title="Pedometer" subtitle="ก้าวเล็ก ๆ ทุกวัน" />

      <GlassCard className="p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
          <Ring value={p.steps} max={p.goal} size={196} stroke={16} color="var(--sky)">
            <div>
              <Footprints className="mx-auto size-6 text-sky" />
              <p className="font-display text-4xl font-bold tabular-nums">{p.steps.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">จากเป้า {p.goal.toLocaleString()} ก้าว</p>
            </div>
          </Ring>
          <div className="text-center sm:text-left">
            <p className="font-display text-2xl font-bold text-primary">{pct}%</p>
            <p className="max-w-48 text-sm text-muted-foreground">
              เหลืออีก {Math.max(0, p.goal - p.steps).toLocaleString()} ก้าว สู้ ๆ นะ
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={RouteIcon} label="ระยะทาง" value={`${p.distanceKm} กม.`} tint="bg-sky-soft text-sky" />
        <Stat icon={Flame} label="เผาผลาญ" value={`${p.kcal} kcal`} tint="bg-peach-soft text-peach" />
        <Stat icon={Timer} label="แอคทีฟ" value={`${p.activeMinutes} นาที`} tint="bg-mint-soft text-mint" />
        <Stat icon={Mountain} label="ขึ้นชั้น" value={`${p.floors} ชั้น`} tint="bg-secondary text-secondary-foreground" />
      </div>

      <GlassCard className="mt-4 p-4">
        <SectionTitle title="บันทึกก้าวเพิ่ม" />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            className="glass min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
            aria-label="จำนวนก้าว"
          />
          <button
            onClick={() => steps > 0 && log.mutate(steps)}
            disabled={log.isPending}
            className="press bg-mint-gradient flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {log.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            บันทึก
          </button>
        </div>
        {log.isError && (
          <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {log.error instanceof Error ? log.error.message : "บันทึกไม่สำเร็จ"}
          </p>
        )}
        {log.isSuccess && (
          <p className="mt-3 rounded-2xl bg-mint-soft px-3 py-2.5 text-sm text-mint">บันทึกก้าวเดินสำเร็จ ✓</p>
        )}
      </GlassCard>

      <AutoStepCounter onLogged={() => void qc.invalidateQueries({ queryKey: ["pedometer"] })} />

      <GpsTracker />

      {p.hourly.length > 0 && (
        <GlassCard className="mt-4 p-4">
          <SectionTitle title="ก้าวรายชั่วโมง" />
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={p.hourly} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="h" tickLine={false} axisLine={false} fontSize={12} />
                <Bar dataKey="steps" fill="var(--sky)" radius={[8, 8, 8, 8]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * ตัวนับก้าวอัตโนมัติจากเซ็นเซอร์ accelerometer ของมือถือ (DeviceMotion)
 *
 * อัลกอริทึมเดิม: เทียบค่าความเร่งรวมกับ threshold คงที่ (2.2) แล้วหักแรงโน้มถ่วงด้วยค่าคงที่ 9.8 ตรงๆ
 * ปัญหาของแบบเดิม: (1) ไม่ทนต่อการเอียง/ถือโทรศัพท์คนละท่า เพราะสมมติว่าแรงโน้มถ่วงชี้ตรงๆ เสมอ
 * (2) threshold ตายตัวจุดเดียว ก้าวเบา (เดินเอื่อยๆ) ตรวจไม่เจอ หรือก้าวหนัก/เขย่ามือถือทำให้นับเกิน
 * (3) กันซ้ำด้วย debounce เวลาต่ำสุดอย่างเดียว ไม่เช็คว่าจังหวะห่างกันสมเหตุสมผลกับการเดินจริงไหม
 *
 * ที่ปรับใหม่ให้ใกล้เคียงตัวนับก้าวจริงบนมือถือ (ไม่ใช้ ML/gyroscope fusion ซึ่งเกินความจำเป็นสำหรับเว็บ):
 * 1) ใช้ e.acceleration (ค่าที่ระบบปฏิบัติการหักแรงโน้มถ่วงให้แล้ว) ก่อนถ้ามี — แม่นกว่าคำนวณเอง
 *    ถ้าไม่มีค่อย fallback ไปหักแรงโน้มถ่วงเองด้วย low-pass filter (แทนค่าคงที่ 9.8) ซึ่งปรับตามการเอียง
 *    เครื่องแบบเรียลไทม์ — เป็นเทคนิคมาตรฐานที่ใช้แยกแรงโน้มถ่วงออกจาก linear acceleration
 * 2) threshold ปรับตามความเข้มของการเดินจริง (adaptive): คำนวณจาก min/max ของสัญญาณในหน้าต่างเวลาสั้นๆ
 *    ที่ผ่านมา แทนค่าคงที่ตัวเดียว — เดินเบาก็จับได้ เดินหนัก/วิ่งก็ไม่นับเกิน
 * 3) กันสัญญาณนิ่ง (วางมือถือบนโต๊ะ/สั่นเบาๆ) ไม่ให้กลายเป็นก้าว ด้วยการเช็คว่า amplitude ในหน้าต่าง
 *    ต้องเกินค่าต่ำสุดที่ถือว่า "กำลังเคลื่อนไหวจริง" ก่อน ถึงจะเริ่มตรวจจับพีค
 * 4) เช็คระยะห่างระหว่างก้าวให้อยู่ในช่วงจังหวะเดิน/วิ่งของมนุษย์จริง (~30–240 ก้าว/นาที) ไม่ใช่แค่
 *    debounce เวลาต่ำสุดอย่างเดียว — กันนับซ้ำจากสั่นเล็กน้อยได้ดีกว่า
 *
 * ยังต้องขอ permission ผ่าน user gesture บน iOS 13+ (DeviceMotionEvent.requestPermission) เหมือนเดิม
 * ข้อจำกัดที่ยังมีอยู่จริง: ความแม่นยำยังสู้ native pedometer API (Core Motion / Google Fit) ที่ใช้
 * ฮาร์ดแวร์ co-processor เฉพาะทางไม่ได้ 100% เพราะเว็บเข้าถึงได้แค่ accelerometer ผ่าน devicemotion event
 */
function AutoStepCounter({ onLogged }: { onLogged: () => void }) {
  const [counting, setCounting] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [cadence, setCadence] = useState(0); // ก้าว/นาที ล่าสุด (เฉลี่ยแบบ smoothing)
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const WINDOW_SIZE = 40; // ~0.6–0.8 วินาทีของ sample ล่าสุด ขึ้นกับอัตราสุ่มของอุปกรณ์
  // FIX: บั๊กใหญ่ 🔴 — 0.9 ต่ำเกินไปสำหรับบางเครื่อง ทำให้ noise ปนจากเซนเซอร์ (มือสั่นเบาๆ, วางบนโต๊ะ
  // ที่มีการสั่นสะเทือนเล็กน้อย, หรือ noise จาก e.acceleration บางรุ่น) ถูกนับเป็นการเดินทั้งที่ไม่ได้
  // เดินจริง ปรับขึ้นเป็น 1.6 ให้ต้องมีความเข้มของการเคลื่อนไหวจริงแบบการเดินก่อนถึงจะเริ่มนับพีค
  const MIN_ACTIVE_AMPLITUDE = 1.6; // m/s² ขั้นต่ำที่ถือว่า "กำลังเคลื่อนไหว" ไม่ใช่แค่สั่นนิ่งๆ
  const PEAK_RATIO = 0.55; // สัดส่วนจาก min ถึง max ที่ถือว่าเป็นพีค (ขอบบน hysteresis)
  const LOW_RATIO = 0.3; // สัดส่วนที่ถือว่ากลับสู่ dip แล้ว พร้อมตรวจพีคถัดไป (ขอบล่าง hysteresis)
  const MIN_STEP_INTERVAL_MS = 250; // เร็วสุด ~240 ก้าว/นาที (วิ่งเร็ว) กันนับซ้ำเร็วเกินจริง
  const MAX_GAP_RESET_MS = 2000; // ห่างเกินนี้ถือว่าเริ่มจังหวะเดินใหม่ ไม่ใช้เทียบ interval เดิม

  const bufferRef = useRef<number[]>([]);
  const gravityRef = useRef({ x: 0, y: 0, z: 9.81 });
  const smoothedRef = useRef(0);
  const wasAboveRef = useRef(false);
  const lastStepAtRef = useRef(0);
  const recentIntervalsRef = useRef<number[]>([]);
  const handlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const activeStreakRef = useRef(0);

  const log = useMutation({
    mutationFn: (n: number) => apiPedometerLog(n, { seconds }),
    onSuccess: onLogged,
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!counting) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [counting]);

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const now = Date.now();
    let mx: number, my: number, mz: number;

    const lin = e.acceleration;
    if (lin && lin.x !== null && lin.y !== null && lin.z !== null) {
      // อุปกรณ์/เบราว์เซอร์คำนวณ linear acceleration (หักแรงโน้มถ่วงแล้ว) ให้เอง ใช้ตรงๆ แม่นกว่า
      mx = lin.x;
      my = lin.y;
      mz = lin.z;
    } else {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x === null || g.y === null || g.z === null) return;
      // low-pass filter แยกองค์ประกอบแรงโน้มถ่วงแบบปรับตามการเอียงเครื่องจริง แทนค่าคงที่ 9.8
      const alpha = 0.15;
      const grav = gravityRef.current;
      grav.x = alpha * g.x + (1 - alpha) * grav.x;
      grav.y = alpha * g.y + (1 - alpha) * grav.y;
      grav.z = alpha * g.z + (1 - alpha) * grav.z;
      mx = g.x - grav.x;
      my = g.y - grav.y;
      mz = g.z - grav.z;
    }

    const rawMag = Math.sqrt(mx * mx + my * my + mz * mz);
    // smoothing เบาๆ กัน noise เฟรมต่อเฟรม โดยไม่หน่วงจังหวะพีคจริงมากเกินไป
    const smooth = 0.35 * rawMag + 0.65 * smoothedRef.current;
    smoothedRef.current = smooth;

    const buf = bufferRef.current;
    buf.push(smooth);
    if (buf.length > WINDOW_SIZE) buf.shift();
    if (buf.length < 8) return; // รอสะสม sample ให้พอก่อนเริ่มประมวลผล

    let min = buf[0]!;
    let max = buf[0]!;
    for (const v of buf) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const amplitude = max - min;

    if (amplitude < MIN_ACTIVE_AMPLITUDE) {
      // สัญญาณนิ่งเกินไป (วางมือถือเฉยๆ/สั่นเบาๆ) — ยังไม่ถือว่ากำลังเดิน กันนับมั่ว
      wasAboveRef.current = false;
      activeStreakRef.current = 0;
      return;
    }
    // FIX: บั๊กใหญ่ 🔴 — เดิมพอ amplitude เกิน threshold "ครั้งเดียว" ก็เริ่มตรวจพีคทันที สัญญาณกระตุก
    // สั้นๆ ครั้งเดียว (เช่น วางมือถือกระแทกโต๊ะ, เดินสะดุด) จะโดนนับเป็นก้าวได้ทั้งที่ไม่ได้เดินต่อเนื่อง
    // ต้องเห็นสัญญาณเข้มพอต่อเนื่องกันอย่างน้อย 4 รอบ sample ก่อน ถึงจะเชื่อว่ากำลังเดินจริง
    activeStreakRef.current += 1;
    if (activeStreakRef.current < 4) return;

    const upperThreshold = min + amplitude * PEAK_RATIO;
    const lowerThreshold = min + amplitude * LOW_RATIO;

    if (!wasAboveRef.current && smooth > upperThreshold) {
      const interval = now - lastStepAtRef.current;
      const isFirstStep = lastStepAtRef.current === 0;
      const isNewStride = interval > MAX_GAP_RESET_MS;
      const isPlausiblePace = interval >= MIN_STEP_INTERVAL_MS;

      if (isFirstStep || isNewStride || isPlausiblePace) {
        if (!isFirstStep && !isNewStride) {
          recentIntervalsRef.current.push(interval);
          if (recentIntervalsRef.current.length > 8) recentIntervalsRef.current.shift();
          const avg =
            recentIntervalsRef.current.reduce((a, b) => a + b, 0) / recentIntervalsRef.current.length;
          setCadence(Math.round(60000 / avg));
        } else if (isNewStride) {
          recentIntervalsRef.current = [];
        }
        lastStepAtRef.current = now;
        setLiveSteps((s) => s + 1);
      }
      wasAboveRef.current = true;
    } else if (wasAboveRef.current && smooth < lowerThreshold) {
      wasAboveRef.current = false;
    }
  }, []);

  const start = async () => {
    setError(null);
    const DME = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    try {
      if (typeof DME.requestPermission === "function") {
        const perm = await DME.requestPermission();
        if (perm !== "granted") {
          setError("ต้องอนุญาตให้เข้าถึงเซ็นเซอร์การเคลื่อนไหวก่อนถึงจะนับก้าวอัตโนมัติได้");
          return;
        }
      }
      bufferRef.current = [];
      gravityRef.current = { x: 0, y: 0, z: 9.81 };
      smoothedRef.current = 0;
      wasAboveRef.current = false;
      lastStepAtRef.current = 0;
      recentIntervalsRef.current = [];
      activeStreakRef.current = 0;
      setLiveSteps(0);
      setSeconds(0);
      setCadence(0);
      handlerRef.current = handleMotion;
      window.addEventListener("devicemotion", handleMotion);
      setCounting(true);
    } catch {
      setError("เปิดเซ็นเซอร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  };

  const stop = () => {
    if (handlerRef.current) window.removeEventListener("devicemotion", handlerRef.current);
    handlerRef.current = null;
    setCounting(false);
    setCadence(0);
    if (liveSteps > 0) log.mutate(liveSteps);
  };

  useEffect(() => {
    return () => {
      if (handlerRef.current) window.removeEventListener("devicemotion", handlerRef.current);
    };
  }, []);

  if (!supported) {
    return (
      <GlassCard className="mt-4 p-4">
        <SectionTitle title="นับก้าวอัตโนมัติ" />
        <p className="text-sm text-muted-foreground">
          อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับเซ็นเซอร์การเคลื่อนไหว (DeviceMotion) — ใช้ช่อง
          &quot;บันทึกก้าวเพิ่ม&quot; ด้านบนแทนได้
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="mt-4 p-4">
      <SectionTitle title="นับก้าวอัตโนมัติ (เซ็นเซอร์มือถือ)" />
      <div className="flex items-center gap-4">
        <span
          className={`grid size-14 shrink-0 place-items-center rounded-3xl ${
            counting ? "bg-sky-soft text-sky animate-pulse" : "bg-muted text-muted-foreground"
          }`}
        >
          <Footprints className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-3xl font-bold tabular-nums">{liveSteps.toLocaleString()} ก้าว</p>
          <p className="truncate text-xs text-muted-foreground">
            {counting
              ? `กำลังนับ · ${fmtDuration(seconds)}${cadence > 0 ? ` · ${cadence} ก้าว/นาที` : ""}`
              : "ถือมือถือไว้กับตัวแล้วกดเริ่ม"}
          </p>
        </div>
        <button
          onClick={() => void (counting ? stop() : start())}
          disabled={log.isPending}
          className={`press flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-glow disabled:opacity-60 ${
            counting ? "bg-destructive text-destructive-foreground" : "bg-mint-gradient text-primary-foreground"
          }`}
        >
          {counting ? <Square className="size-4" /> : <Play className="size-4" />}
          {counting ? "หยุด & บันทึก" : "เริ่มนับ"}
        </button>
      </div>
      {error && <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}
      {log.isError && (
        <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {log.error instanceof Error ? log.error.message : "บันทึกก้าวไม่สำเร็จ"}
        </p>
      )}
      {log.isSuccess && !counting && (
        <p className="mt-3 rounded-2xl bg-mint-soft px-3 py-2.5 text-sm text-mint">บันทึกก้าวที่นับได้แล้ว ✓</p>
      )}
    </GlassCard>
  );
}

/** วาดเส้นทาง GPS เป็น SVG polyline โดย normalize lat/lng ให้พอดี viewBox (ไม่พึ่ง map tile ภายนอก) */
function RouteMap({ points }: { points: GeoPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="grid h-40 w-full place-items-center rounded-2xl bg-muted/60 text-xs text-muted-foreground">
        {points.length === 0 ? "ยังไม่มีพิกัด — เริ่มเดินเพื่อดูเส้นทาง" : "กำลังรอพิกัดเพิ่มเติม…"}
      </div>
    );
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;
  const W = 300;
  const H = 160;
  const pad = 16;

  const toXY = (p: GeoPoint) => {
    const x = pad + ((p.lng - minLng) / lngSpan) * (W - pad * 2);
    // กลับแกน y เพราะ lat มากกว่า = ทิศเหนือ = อยู่บนสุด
    const y = H - pad - ((p.lat - minLat) / latSpan) * (H - pad * 2);
    return { x, y };
  };

  const pathD = points
    .map((p, i) => {
      const { x, y } = toXY(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const start = toXY(points[0]!);
  const end = toXY(points[points.length - 1]!);

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-muted/60">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label="แผนที่เส้นทางที่บันทึกไว้">
        <path d={pathD} fill="none" stroke="var(--mint)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={start.x} cy={start.y} r={5} fill="var(--sky)" />
        <circle cx={end.x} cy={end.y} r={5} fill="var(--peach)" />
      </svg>
    </div>
  );
}

function GpsTracker() {
  // FIX: `user` ถูกใช้ด้านล่าง (ส่งเป็น selfAvatar ให้ LiveTrackMap) แต่ GpsTracker เป็นคอมโพเนนต์
  // แยกจากที่ดึง useAuth() ไว้ ทำให้ `user` ไม่อยู่ใน scope -> ReferenceError: user is not defined
  // (หน้าเด้ง error ทันทีตอนเปิดหน้านับก้าว) ดึง useAuth() ในคอมโพเนนต์นี้เองให้ถูก scope
  const { user } = useAuth();
  const qc = useQueryClient();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareResult, setShareResult] = useState<"shared" | "copied" | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  // FIX: เพิ่มใหม่ — เก็บหมุดเป้าหมายที่มาร์กจากเสียง/ปุ่ม ส่งต่อให้ LiveTrackMap วาดเส้นทาง+ระยะทางให้
  const [destination, setDestinationState] = useState<GeoResult | null>(null);
  // FIX: เพิ่มใหม่ — เป้าหมายระยะทางวิ่ง/เดินจากเสียง ("อยากวิ่งกี่กิโล") ส่งต่อให้ LiveTrackMap โชว์ progress
  const [goalKm, setGoalKmState] = useState<number | null>(null);
  // FIX: บั๊กใหญ่ 🔴 — เดิมประกาศ sharingRouteId ไว้ใน PedometerPage (คอมโพเนนต์แม่) แต่ปุ่ม "แชร์" และ
  // ตัว ShareRunModal ที่ใช้ตัวแปรนี้จริงๆ อยู่ใน GpsTracker (คอมโพเนนต์แยกกันคนละ scope) ทำให้เกิด
  // "ReferenceError: sharingRouteId is not defined" พังทั้งหน้าทันทีที่โหลด (ตรงกับบั๊ก `user` ที่เคย
  // เจอมาก่อนหน้านี้ในคอมเมนต์ด้านบน) ย้ายมาประกาศใน GpsTracker ให้ถูก scope
  const [sharingRouteId, setSharingRouteId] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  // FIX: เพิ่มใหม่ — เก็บ routeId จริงจาก server แยกจาก routeId ที่โชว์ในหน้าจอ (ซึ่งอาจเป็น local id
  // ชั่วคราวตอนออฟไลน์) เพราะเริ่มวิ่งได้ทันทีโดยไม่ต้องรอ apiRouteStart() เสร็จก่อน (ดู start() ด้านล่าง)
  const serverRouteIdRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const history = useQuery({ queryKey: ["route", "history"], queryFn: apiRouteHistory });

  // FIX: เพิ่มใหม่ — ดึงตำแหน่งเพื่อนที่เปิดแชร์ไว้ มาโชว์เป็นหมุดบนแผนที่ตอนกำลังวิ่ง/เดิน
  // (โพลทุก 8 วิ พอสำหรับตำแหน่งคน ไม่ต้องเรียลไทม์จัดจนกินแบตเตอรี่) + รายชื่อเพื่อนไว้จับคู่
  // avatar/ชื่อ เพราะ apiFriendLocations คืนแค่ friendId/lat/lng ไม่มีชื่อ/avatar ติดมาด้วย
  const friendsForMap = useQuery({ queryKey: ["friends", "list"], queryFn: apiFriendsList });
  const friendLocationsQuery = useQuery({
    queryKey: ["friends", "locations"],
    queryFn: apiFriendLocations,
    enabled: !!routeId,
    refetchInterval: routeId ? 8000 : false,
  });
  const sharingStatus = useQuery({ queryKey: ["friends", "location-sharing"], queryFn: apiFriendLocationSharingStatus });

  const friendMapPins = (friendLocationsQuery.data ?? []).map((loc) => {
    const info = (friendsForMap.data ?? []).find((f) => f.id === loc.friendId);
    return { friendId: loc.friendId, name: info?.name ?? "เพื่อน", avatar: info?.avatar, lat: loc.lat, lng: loc.lng };
  });

  // FIX: เพิ่มใหม่ — ระหว่างกำลังวิ่ง/เดิน ถ้าเปิดแชร์ตำแหน่งไว้ (ตั้งค่าได้ที่หน้าเพื่อน) ให้เริ่ม
  // ส่งตำแหน่งสดให้เพื่อนผ่าน service กลางที่มีอยู่แล้ว (friend-location.ts — มี watchPosition +
  // throttle ส่งขึ้น server ทุก 5 วิ ในตัวอยู่แล้ว) แทนที่จะเปิด GPS watcher ซ้ำซ้อนเองอีกชุด
  // ซึ่งจะกิน battery คู่กันโดยไม่จำเป็นและอาจส่งตำแหน่งชนกันเป็นสอง request พร้อมกัน
  useEffect(() => {
    if (routeId && sharingStatus.data?.enabled) {
      void startFriendLocationSharing();
    } else {
      void stopFriendLocationSharing();
    }
    return () => { void stopFriendLocationSharing(); };
  }, [routeId, sharingStatus.data?.enabled]);

  useEffect(() => {
    if (!routeId) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [routeId]);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  // FIX: เพิ่มใหม่ — ตามที่ขอ "รันสะสมแบบ real-time ไม่ต้องรอวิ่งเสร็จ" คำนวณระยะทาง/kcal จาก
  // พิกัดที่มีอยู่ในเครื่องตรงๆ ทุกครั้งที่ได้พิกัดใหม่ (สูตรเดียวกับ server เป๊ะๆ) แทนที่จะรอเรียก
  // apiRouteStop() ตอนจบแล้วค่อยรู้ตัวเลข — ผู้ใช้เห็นระยะทาง/kcal อัปเดตสดระหว่างวิ่งทันที
  const liveDistanceKm = points.length >= 2
    ? points.slice(1).reduce((sum, p, i) => sum + haversineKm(points[i]!, p), 0)
    : 0;
  const liveKcal = estimateKcalBurnedClient(liveDistanceKm, seconds);

  // FIX: เพิ่มใหม่ — ตามที่ขอ "ตั้งค่าให้ใช้ได้ทั้งมีเน็ตและไม่มีเน็ต" ลองซิงค์เส้นทางที่ค้างอยู่ใน
  // เครื่อง (บันทึกไว้ตอนไม่มีเน็ต) ขึ้น server อัตโนมัติ ทั้งตอนเปิดหน้านี้ และทันทีที่อุปกรณ์กลับมา
  // ออนไลน์ (เบราว์เซอร์ยิง event "online" ให้เอง) โดยไม่ต้องให้ผู้ใช้กดอะไรเพิ่ม
  useEffect(() => {
    setPendingCount(getPendingRoutes().length);
    const sync = () => {
      void flushPendingRoutes(() => {
        setPendingCount(getPendingRoutes().length);
        void qc.invalidateQueries({ queryKey: ["route", "history"] });
      });
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [qc]);

  const start = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง (GPS)");
      return;
    }
    // FIX: เดิมต้องรอ apiRouteStart() (เรียก server) สำเร็จก่อนถึงจะเริ่มจับ GPS ได้ — ถ้าตอนนั้นไม่มี
    // เน็ต/server ตอบช้า ผู้ใช้กด "เริ่ม" แล้วไม่เกิดอะไรขึ้นเลย (ตรงกับปัญหา "เชื่อมต่อเซิร์ฟเวอร์ไม่
    // สำเร็จ" ที่เจอ) ตามที่ขอ "ใช้ได้ทั้งมีเน็ตและไม่มีเน็ต" — เริ่มจับ GPS ทันทีในเครื่องก่อนเสมอ ไม่รอ
    // เน็ต แล้วค่อยเรียก apiRouteStart() แบบ background เก็บ routeId จริงไว้ใช้ตอนกดหยุด (ถ้าเรียกไม่ได้
    // ก็ไม่เป็นไร เดี๋ยวไปหา routeId ใหม่ตอนกดหยุดอีกที หรือ fallback เป็นบันทึกในเครื่องรอซิงค์)
    serverRouteIdRef.current = null;
    setRouteId(`local-${Date.now()}`);
    setSeconds(0);
    setPoints([]);
    setBusy(false);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        setPoints((ps) => {
          // FIX: บั๊กใหญ่ 🔴 — เดิมรับพิกัด GPS ทุกจุดที่ browser ส่งมาโดยไม่กรองเลย แม้ยืนอยู่
          // กับที่สัญญาณ GPS ก็มักเพี้ยน/สั่นไปมาในระยะไม่กี่เมตรตามธรรมชาติของ GPS มือถือ พอเอา
          // จุดเพี้ยนๆ พวกนี้มาคำนวณระยะทางรวมกันเรื่อยๆ ระยะทาง (และก้าวที่แปลงจากระยะทาง)
          // เลยเพิ่มขึ้นเองทั้งที่ไม่ได้เดิน แก้โดย: (1) ทิ้งพิกัดที่ accuracy แย่เกิน 25 เมตร
          // (สัญญาณไม่นิ่งพอเชื่อถือได้) (2) ทิ้งพิกัดที่ขยับจากจุดก่อนหน้าน้อยกว่า 3 เมตร (คือ noise
          // ไม่ใช่การเดินจริง — คนเดินช้าสุดก็ยังขยับได้มากกว่านี้ในช่วงเวลาสุ่มตัวอย่างของ GPS)
          if (pos.coords.accuracy != null && pos.coords.accuracy > 25) return ps;
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const last = ps[ps.length - 1];
          if (last) {
            const movedKm = haversineKm(last, next);
            if (movedKm * 1000 < 3) return ps;
          }
          return [...ps, next];
        }),
      () => setError("ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาตสิทธิ์ GPS"),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    // เรียก server แบบ background ไม่บล็อก UI — สำเร็จก็เก็บ routeId จริงไว้เงียบๆ, ไม่สำเร็จก็ไม่ต้อง
    // โชว์ error แดงกวนใจระหว่างวิ่ง (เดี๋ยวไปจัดการตอนกดหยุดอีกที ตามที่ขอให้ใช้งานได้แม้ไม่มีเน็ต)
    try {
      const id = await apiRouteStart({ goalKm: goalKm ?? 0 });
      if (id) serverRouteIdRef.current = id;
    } catch {
      // ไม่มีเน็ต/server ไม่ตอบ — ปล่อยผ่าน จะลองใหม่ตอนกดหยุด
    }
  }, [goalKm]);

  const stop = useCallback(async () => {
    if (!routeId) return;
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    // FIX: เพิ่มใหม่ — backend บังคับต้องมีพิกัดอย่างน้อย 2 จุดถึงจะคำนวณระยะทางได้ (haversine ต้องมี
    // จุดคู่) ถ้ากด "หยุด" เร็วเกินไปก่อนที่ GPS จะได้พิกัดที่ 2 (เช่น สัญญาณช้า/กดหยุดทันทีหลังกดเริ่ม)
    // เดิมจะยิง request ไปแล้วโดน backend ปฏิเสธด้วยข้อความ zod ดิบๆ ที่ผู้ใช้งงว่าหมายถึงอะไร
    // แก้โดยเช็คก่อนฝั่ง frontend แล้วโชว์ข้อความไทยที่เข้าใจง่ายแทน ไม่ต้องยิง request เลย
    if (points.length < 2) {
      setError("ยังเก็บพิกัดได้ไม่พอ (ต้องมีอย่างน้อย 2 จุด) กรุณารอสักครู่ให้ GPS จับสัญญาณแล้วลองหยุดใหม่");
      setBusy(false);
      setRouteId(null);
      return;
    }
    const finalPoints = points;
    const finalSeconds = seconds;
    setError(null);
    setNotice(null);
    try {
      setBusy(true);
      // ถ้าตอน start() ยังไม่ได้ routeId จริงจาก server (ออฟไลน์ตอนนั้น) ลองขอใหม่อีกครั้งตอนนี้
      // ก่อนค่อย fallback ไปบันทึกในเครื่อง เผื่อเน็ตกลับมาแล้วระหว่างวิ่ง
      let realRouteId = serverRouteIdRef.current;
      if (!realRouteId) {
        try {
          realRouteId = await apiRouteStart({ goalKm: goalKm ?? 0 });
        } catch {
          realRouteId = null;
        }
      }
      if (!realRouteId) throw new Error("offline");
      await apiRouteStop({ routeId: realRouteId, path: finalPoints, durationSeconds: finalSeconds });
      void qc.invalidateQueries({ queryKey: ["route"] });
      void qc.invalidateQueries({ queryKey: ["pedometer"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      // FIX: เพิ่มใหม่ — ตามที่ขอ "ใช้ได้ทั้งมีเน็ตและไม่มีเน็ต" ถ้าบันทึกขึ้น server ไม่สำเร็จ (ไม่มีเน็ต/
      // server ล่มชั่วคราว) ไม่ทำข้อมูลการวิ่งหาย — คำนวณระยะทาง/kcal ในเครื่องแล้วเก็บลงคิวรอซิงค์แทน
      // โชว์เป็นข้อความสำเร็จ (เขียว) ไม่ใช่ error (แดง) เพราะจากมุมผู้ใช้ "บันทึกได้แล้ว" จริงๆ
      const isNetworkIssue = e instanceof Error && (e.message === "offline" || /เชื่อมต่อเซิร์ฟเวอร์|fetch/i.test(e.message));
      if (isNetworkIssue) {
        const distanceKm = finalPoints.slice(1).reduce((sum, p, i) => sum + haversineKm(finalPoints[i]!, p), 0);
        const kcal = estimateKcalBurnedClient(distanceKm, finalSeconds);
        enqueuePendingRoute({ path: finalPoints, durationSeconds: finalSeconds, distanceKm, kcal });
        setPendingCount(getPendingRoutes().length);
        setNotice(`บันทึกในเครื่องแล้ว (${distanceKm.toFixed(2)} กม. · ${kcal} kcal) — จะซิงค์ขึ้นระบบอัตโนมัติเมื่อมีเน็ต`);
      } else {
        setError(e instanceof Error ? e.message : "บันทึกเส้นทางไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
      setRouteId(null);
      serverRouteIdRef.current = null;
    }
  }, [routeId, points, seconds, qc, goalKm]);

  // FIX: เพิ่มใหม่ — เดิมไม่มีทาง "มาร์กเป้าหมาย/แชร์โลเคชั่น" ได้เลย ไม่ว่าจะกดปุ่มหรือสั่งด้วยเสียง
  // ฟังก์ชันนี้จับพิกัดปัจจุบัน (ไม่ต้องรอ route กำลังบันทึกอยู่ก็ใช้ได้) แล้วสร้างลิงก์ Google Maps
  // ไปยังพิกัดนั้น (ทำหน้าที่เป็น "หมุดเป้าหมาย" ที่แชร์ต่อได้) — ใช้ Web Share API ถ้าเบราว์เซอร์รองรับ
  // (เปิด share sheet ของมือถือให้เลือกแอปที่จะส่งต่อ เช่น Line/Messenger) ถ้าไม่รองรับ fallback
  // เป็นคัดลอกลิงก์เข้าคลิปบอร์ดแทน
  const shareLocation = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง (GPS)");
      return;
    }
    setShareBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }),
      );
      const { latitude, longitude } = pos.coords;
      const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      const text = `ตำแหน่งปัจจุบันของฉัน: ${mapsUrl}`;
      if (navigator.share) {
        await navigator.share({ title: "ตำแหน่งปัจจุบันของฉัน", text: mapsUrl });
        setShareResult("shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareResult("copied");
      } else {
        setError(mapsUrl);
      }
      setTimeout(() => setShareResult(null), 3000);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        // ผู้ใช้กดยกเลิก share sheet เอง — ไม่ใช่ error ที่ต้องแจ้ง
      } else if (e instanceof GeolocationPositionError || (e as GeolocationPositionError)?.code) {
        setError("ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาตสิทธิ์ GPS");
      } else {
        setError("แชร์ตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    } finally {
      setShareBusy(false);
    }
  }, []);

  // ลงทะเบียนกับ gpsBridge เพื่อให้สั่งเริ่ม/หยุด/แชร์ตำแหน่งด้วยเสียงได้จริง
  // (เดิมไม่มีบรรทัดนี้ ทำให้สั่งด้วยเสียงไม่มีผลอะไรเลย แม้แชทจะตอบว่าทำสำเร็จ)
  useEffect(() => {
    gpsBridge.register({ start, stop, shareLocation, setDestination: (dest) => setDestinationState(dest), setGoalKm: (km) => setGoalKmState(km) });
    return () => gpsBridge.unregister();
  }, [start, stop, shareLocation]);

  return (
    <>
      <GlassCard className="mt-4 p-5">
        <SectionTitle
          title="วิ่ง/เดินแบบติดตามเส้นทาง (GPS)"
          action={
            <Link to="/workout" className="flex items-center gap-1 text-xs font-medium text-primary">
              <Dumbbell className="size-3.5" /> ออกกำลังกาย
            </Link>
          }
        />
        <div className="flex items-center gap-4">
          <span
            className={`grid size-14 shrink-0 place-items-center rounded-3xl ${
              routeId ? "bg-mint-soft text-mint animate-pulse" : "bg-muted text-muted-foreground"
            }`}
          >
            <MapPin className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-3xl font-bold tabular-nums">{fmtDuration(seconds)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {routeId
                ? `${liveDistanceKm.toFixed(2)} กม. · ${liveKcal} kcal · ${points.length} จุด`
                : "พร้อมเริ่มบันทึกเส้นทาง"}
            </p>
          </div>
          <button
            onClick={() => void (routeId ? stop() : start())}
            disabled={busy}
            className={`press flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-glow disabled:opacity-60 ${
              routeId
                ? "bg-destructive text-destructive-foreground"
                : "bg-mint-gradient text-primary-foreground"
            }`}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : routeId ? (
              <Square className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {routeId ? "หยุด" : "เริ่ม"}
          </button>
        </div>
        <button
          onClick={() => void shareLocation()}
          disabled={shareBusy}
          className="press glass mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium disabled:opacity-60"
        >
          {shareBusy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          แชร์ตำแหน่งปัจจุบัน
        </button>
        {shareResult && (
          <p className="mt-2 text-center text-xs text-mint">
            {shareResult === "shared" ? "แชร์ตำแหน่งสำเร็จ ✓" : "คัดลอกลิงก์ตำแหน่งแล้ว ✓"}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
        )}
        {notice && (
          <p className="mt-3 rounded-2xl bg-mint-soft px-3 py-2.5 text-sm text-mint">{notice}</p>
        )}
        {pendingCount > 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            มี {pendingCount} เส้นทางรอซิงค์ขึ้นระบบ (จะซิงค์อัตโนมัติเมื่อมีเน็ต)
          </p>
        )}
        {routeId && (
          <div className="mt-4">
            {/* LiveTrackMap ทำ geolocation.watchPosition ของตัวเอง ไม่ส่ง onSessionEnd
                เพราะปุ่ม "หยุด" ด้านบน (stop() → apiRouteStop()) บันทึกจริงอยู่แล้ว —
                ถ้าส่ง onSessionEnd ด้วยจะเสี่ยงบันทึกซ้ำ 2 ครั้ง ในนี้ทำหน้าที่แค่โชว์แผนที่จริงระหว่างวิ่ง */}
            <LiveTrackMap steps={points.length} destination={destination} goalKm={goalKm} friendLocations={friendMapPins} selfAvatar={String(user?.["avatar"] ?? "")} />
          </div>
        )}
        {!routeId && points.length > 0 && (
          <div className="mt-4">
            <RouteMap points={points} />
          </div>
        )}
      </GlassCard>

      <GlassCard className="mt-4 p-4">
        <SectionTitle title="ประวัติเส้นทาง" />
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : history.data && history.data.length > 0 ? (
          <div className="space-y-2">
            {history.data.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
                <RouteIcon className="size-4 shrink-0 text-sky" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.distanceKm.toFixed(2)} กม.</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.date} · {fmtDuration(r.durationSeconds)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-peach">{r.kcal} kcal</span>
                {/* FIX: เพิ่มใหม่ — ปุ่มแชร์สถิติการวิ่งพร้อมเส้นทางจริง ตามที่ขอ */}
                <button
                  onClick={() => setSharingRouteId(r.id)}
                  className="press glass grid size-8 shrink-0 place-items-center rounded-xl text-mint"
                  aria-label="แชร์สถิติเส้นทางนี้"
                >
                  <Share2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีเส้นทางที่บันทึกไว้</p>
        )}
      </GlassCard>

      {sharingRouteId && <ShareRunModal routeId={sharingRouteId} onClose={() => setSharingRouteId(null)} />}
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="glass-strong rounded-3xl p-4 shadow-soft">
      <span className={`grid size-10 place-items-center rounded-2xl ${tint}`}>
        <Icon className="size-5" />
      </span>
      <p className="mt-2 truncate font-display font-bold tabular-nums">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** FIX: เพิ่มใหม่ — โมดัลแชร์สถิติการวิ่งพร้อมเส้นทางจริง เลือกสีเส้น (วงล้อสีของระบบ) และพื้นหลังเองได้
    ตามดีไซน์ที่ผู้ใช้ส่งมา ดึงตัวเลข Dist/Time/Pace จากข้อมูลจริงที่บันทึกไว้ตอนจบการวิ่ง ไม่ปัดเพี้ยน */
function ShareRunModal({ routeId, onClose }: { routeId: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lineColor, setLineColor] = useState("#e0201a");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareResult, setShareResult] = useState<"shared" | "downloaded" | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const detail = useQuery({ queryKey: ["route", "detail", routeId], queryFn: () => apiRouteDetail(routeId) });

  useEffect(() => {
    if (!detail.data || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);
    setRenderError(null);
    renderRunSharePreview(canvasRef.current, {
      distanceKm: detail.data.distanceKm,
      durationSeconds: detail.data.durationSeconds,
      path: detail.data.path,
      lineColor,
      backgroundImage: bgImage,
      date: detail.data.date ? new Date(detail.data.date) : new Date(),
    })
      .then((b) => { if (!cancelled) setBlob(b); })
      .catch((err) => { if (!cancelled) setRenderError(err instanceof Error ? err.message : "สร้างรูปตัวอย่างไม่สำเร็จ"); })
      .finally(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; };
  }, [detail.data, lineColor, bgImage]);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      setBgImage(img);
    } catch {
      setRenderError("อัปโหลดรูปพื้นหลังไม่สำเร็จ ลองไฟล์อื่น");
    }
  };

  const handleShare = async () => {
    if (!blob) return;
    setShareBusy(true);
    setShareError(null);
    try {
      const result = await shareOrDownloadImage(blob, `wk-health-run-${routeId}.png`);
      if (result !== "cancelled") {
        setShareResult(result);
        setTimeout(() => setShareResult(null), 3000);
      }
    } catch {
      setShareError("แชร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        className="glass-strong flex max-h-[92vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold">แชร์สถิติการวิ่ง</p>
          <button onClick={onClose} className="press glass grid size-8 place-items-center rounded-xl" aria-label="ปิด">
            <X className="size-4" />
          </button>
        </div>

        {detail.isLoading ? (
          <Skeleton className="aspect-[9/16] w-full rounded-2xl" />
        ) : detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-muted">
            <canvas ref={canvasRef} className="w-full" />
            {rendering && (
              <div className="absolute inset-0 grid place-items-center bg-black/30">
                <Loader2 className="size-6 animate-spin text-white" />
              </div>
            )}
          </div>
        )}
        {renderError && <p className="text-xs text-destructive">{renderError}</p>}

        <div className="flex items-center gap-2">
          <label className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs">
            <span className="text-muted-foreground">สีเส้นทาง</span>
            <input
              type="color"
              value={lineColor}
              onChange={(e) => setLineColor(e.target.value)}
              className="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
              aria-label="เลือกสีเส้นทาง"
            />
          </label>
          <label className="press glass flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" /> พื้นหลังเอง
            <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
          </label>
          {bgImage && (
            <button
              onClick={() => setBgImage(null)}
              className="press glass grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground"
              aria-label="ลบพื้นหลังที่อัปโหลด กลับไปใช้พื้นขาว"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {shareResult && (
          <p className="flex items-center gap-1 text-xs text-mint">
            <Check className="size-3.5" />
            {shareResult === "shared" ? "แชร์รูปสำเร็จ" : "บันทึกรูปลงเครื่องแล้ว"}
          </p>
        )}
        {shareError && <p className="text-xs text-destructive">{shareError}</p>}

        <button
          onClick={handleShare}
          disabled={!blob || rendering || shareBusy}
          className="press bg-mint-gradient flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {shareBusy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} แชร์รูปนี้
        </button>
      </div>
    </div>
  );
}
