import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { Dumbbell, Flame, Footprints, Loader2, MapPin, Mountain, Play, Plus, Route as RouteIcon, Square, Timer } from "lucide-react";
import { PageHeader, GlassCard, Ring, SectionTitle } from "@/components/app/ui-bits";
import { ErrorState, LoadingState } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import {
  apiPedometerLog,
  apiPedometerToday,
  apiRouteHistory,
  apiRouteStart,
  apiRouteStop,
  type GeoPoint,
} from "@/lib/api";

export const Route = createFileRoute("/pedometer")({
  head: () => ({
    meta: [
      { title: "นับก้าวเดิน — WK Health App" },
      { name: "description", content: "ติดตามจำนวนก้าว ระยะทาง แคลอรีที่เผาผลาญ และนาทีแอคทีฟในแต่ละวัน" },
      { property: "og:title", content: "นับก้าวเดิน — WK Health App" },
      { property: "og:description", content: "ติดตามก้าวเดิน ระยะทาง และแคลอรีที่เผาผลาญ" },
    ],
  }),
  component: PedometerPage,
});

function PedometerPage() {
  const { isAuthenticated } = useAuth();
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
        <PageHeader title="Pedometer" emoji="🚶" subtitle="ก้าวเล็ก ๆ ทุกวัน" />
        <GlassCard className="p-6 text-center text-sm text-muted-foreground">
          กรุณาเข้าสู่ระบบก่อนใช้งานหน้านี้
        </GlassCard>
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="rise-in">
        <PageHeader title="Pedometer" emoji="🚶" subtitle="ก้าวเล็ก ๆ ทุกวัน" />
        <LoadingState label="กำลังโหลดข้อมูลก้าวเดิน…" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="rise-in">
        <PageHeader title="Pedometer" emoji="🚶" subtitle="ก้าวเล็ก ๆ ทุกวัน" />
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const p = q.data;
  const pct = p.goal ? Math.round((p.steps / p.goal) * 100) : 0;

  return (
    <div className="rise-in">
      <PageHeader title="Pedometer" emoji="🚶" subtitle="ก้าวเล็ก ๆ ทุกวัน" />

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
              เหลืออีก {Math.max(0, p.goal - p.steps).toLocaleString()} ก้าว สู้ ๆ นะ 💪
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
 * ADDED (ของเดิมไม่มีเลย): ตัวนับก้าวอัตโนมัติจริงจากเซ็นเซอร์ accelerometer ของมือถือ
 * (DeviceMotion) — ก่อนหน้านี้หน้า Pedometer มีแค่ช่องกรอกตัวเลขเอง ไม่มีโค้ดอ่านเซ็นเซอร์เลยสักบรรทัด
 * จึงไม่มีทาง "นับก้าว" ที่เดินจริงได้เอง ต้องพิมพ์มือทุกครั้ง
 *
 * วิธีทำงาน: อ่านค่าความเร่งรวม (magnitude) จาก devicemotion event แล้วตรวจจับจังหวะ "พีค"
 * ที่ข้าม threshold ขึ้นมา (เทียบกับ dip ก่อนหน้า) พร้อม debounce ขั้นต่ำ 280ms ต่อก้าว
 * เพื่อกันนับซ้ำจากการสั่นสะเทือนเล็กๆ — เป็นอัลกอริทึมนับก้าวแบบพื้นฐานที่ใช้กันทั่วไปบนเว็บ
 * (ความแม่นยำจะสู้ native pedometer API ของ iOS/Android ไม่ได้ 100% แต่ทำงานได้จริงบนเบราว์เซอร์)
 *
 * ต้องขอ permission ผ่าน user gesture บน iOS 13+ (DeviceMotionEvent.requestPermission)
 */
function AutoStepCounter({ onLogged }: { onLogged: () => void }) {
  const [counting, setCounting] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const lastStepAtRef = useRef(0);
  const wasBelowRef = useRef(true);
  const handlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

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
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    const delta = magnitude - 9.8; // หักแรงโน้มถ่วงคงที่คร่าวๆ
    const THRESHOLD = 2.2; // ปรับตามความไวที่ต้องการ
    const now = Date.now();

    if (delta < THRESHOLD * 0.4) {
      wasBelowRef.current = true;
    } else if (delta > THRESHOLD && wasBelowRef.current) {
      if (now - lastStepAtRef.current > 280) {
        lastStepAtRef.current = now;
        setLiveSteps((s) => s + 1);
      }
      wasBelowRef.current = false;
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
      lastStepAtRef.current = 0;
      wasBelowRef.current = true;
      setLiveSteps(0);
      setSeconds(0);
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
            {counting ? `กำลังนับ · ${fmtDuration(seconds)}` : "ถือมือถือไว้กับตัวแล้วกดเริ่ม"}
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

function GpsTracker() {
  const qc = useQueryClient();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const watchRef = useRef<number | null>(null);

  const history = useQuery({ queryKey: ["route", "history"], queryFn: apiRouteHistory });

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

  const start = async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง (GPS)");
      return;
    }
    try {
      setBusy(true);
      const id = await apiRouteStart();
      setRouteId(id || "temp");
      setSeconds(0);
      setPoints([]);
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) =>
          setPoints((ps) => [...ps, { lat: pos.coords.latitude, lng: pos.coords.longitude }]),
        () => setError("ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาตสิทธิ์ GPS"),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "เริ่มบันทึกเส้นทางไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!routeId) return;
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    try {
      setBusy(true);
      await apiRouteStop({ routeId, path: points, durationSeconds: seconds });
      void qc.invalidateQueries({ queryKey: ["route"] });
      void qc.invalidateQueries({ queryKey: ["pedometer"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกเส้นทางไม่สำเร็จ");
    } finally {
      setBusy(false);
      setRouteId(null);
    }
  };

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
              {routeId ? `กำลังติดตาม · เก็บพิกัดแล้ว ${points.length} จุด` : "พร้อมเริ่มบันทึกเส้นทาง"}
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
        {error && (
          <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
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
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีเส้นทางที่บันทึกไว้</p>
        )}
      </GlassCard>
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
