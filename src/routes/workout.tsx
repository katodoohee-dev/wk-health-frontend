import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Flame, History, Loader2, Plus, Wand2 } from "lucide-react";
import { PageHeader, GlassCard, SectionTitle, Chip } from "@/components/app/ui-bits";
import { useAuth } from "@/lib/auth";
import {
  apiWorkoutHistory,
  apiWorkoutLog,
  apiWorkoutPlan,
  apiWorkoutTodayBurn,
  WORKOUT_GOAL_OPTIONS,
  WORKOUT_LEVEL_OPTIONS,
  type WorkoutExercise,
  type WorkoutGoal,
  type WorkoutLevel,
} from "@/lib/api";

export const Route = createFileRoute("/workout")({
  head: () => ({
    meta: [
      { title: "ออกกำลังกาย — WK Health App" },
      { name: "description", content: "สร้างตารางออกกำลังกายด้วย AI บันทึกท่าที่ทำ และดูแคลอรีที่เผาผลาญวันนี้" },
      { property: "og:title", content: "ออกกำลังกาย — WK Health App" },
      { property: "og:description", content: "ตารางออกกำลังกาย AI พร้อมบันทึกและสถิติการเผาผลาญ" },
    ],
  }),
  component: WorkoutPage,
});

// FIX: backend zod schema ต้องการ enum ภาษาอังกฤษเป๊ะๆ ('weight_loss' | 'maintenance' | 'muscle_gain', 'beginner' | 'intermediate' | 'advanced')
// ของเดิมส่ง label ภาษาไทยตรงๆ ทำให้ 400 validation error ทุกครั้งที่กดสร้างตาราง (ดูเหมือนกดไม่ติด)
// ตอนนี้แยก value (อังกฤษ ส่งจริง) ออกจาก label (ไทย แสดงผล)
const EQUIPMENT = ["ไม่มีอุปกรณ์", "ดัมเบล", "ยางยืด", "ฟิตเนสครบ"];

function WorkoutPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [goal, setGoal] = useState<WorkoutGoal>(WORKOUT_GOAL_OPTIONS[0]!.value);
  const [level, setLevel] = useState<WorkoutLevel>(WORKOUT_LEVEL_OPTIONS[0]!.value);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]!);
  const [daysPerWeek, setDaysPerWeek] = useState(3);

  const burn = useQuery({
    queryKey: ["workout", "burn"],
    queryFn: apiWorkoutTodayBurn,
    enabled: isAuthenticated,
  });
  const history = useQuery({
    queryKey: ["workout", "history"],
    queryFn: apiWorkoutHistory,
    enabled: isAuthenticated,
  });

  const plan = useMutation({
    mutationFn: () => apiWorkoutPlan({ goal, level, equipment, daysPerWeek }),
  });

  const log = useMutation({
    mutationFn: (e: WorkoutExercise) =>
      apiWorkoutLog({
        exerciseName: e.name,
        minutes: e.minutes && e.minutes > 0 ? e.minutes : 20,
        sourceKey: e.sourceKey || "plan",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workout"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  return (
    <div className="rise-in">
      <PageHeader title="ออกกำลังกาย" emoji="🏋️" subtitle="ตารางฝึกจาก AI + บันทึกการเผาผลาญ" />

      <GlassCard className="p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-3xl bg-peach-soft text-peach">
            <Flame className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">เผาผลาญจากการออกกำลังกายวันนี้</p>
            <p className="font-display text-3xl font-bold tabular-nums">
              {burn.isLoading ? "…" : `${burn.data ?? 0} kcal`}
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 p-5">
        <SectionTitle title="สร้างตารางออกกำลังกาย" />
        <p className="mb-2 text-xs text-muted-foreground">เป้าหมาย</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {WORKOUT_GOAL_OPTIONS.map((g) => (
            <Chip key={g.value} active={goal === g.value} onClick={() => setGoal(g.value)}>
              {g.label}
            </Chip>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">ระดับ</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {WORKOUT_LEVEL_OPTIONS.map((l) => (
            <Chip key={l.value} active={level === l.value} onClick={() => setLevel(l.value)}>
              {l.label}
            </Chip>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">อุปกรณ์</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {EQUIPMENT.map((e) => (
            <Chip key={e} active={equipment === e} onClick={() => setEquipment(e)}>{e}</Chip>
          ))}
        </div>

        <label className="mb-4 block">
          <span className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>จำนวนวันต่อสัปดาห์</span>
            <span className="font-semibold text-foreground">{daysPerWeek} วัน</span>
          </span>
          <input
            type="range"
            min={1}
            max={7}
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Number(e.target.value))}
            className="w-full accent-[var(--mint)]"
          />
        </label>

        <button
          onClick={() => plan.mutate()}
          disabled={plan.isPending}
          className="press bg-mint-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {plan.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          สร้างตารางด้วย AI
        </button>
        {plan.isError && (
          <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {plan.error instanceof Error ? plan.error.message : "สร้างตารางไม่สำเร็จ"}
          </p>
        )}
      </GlassCard>

      {plan.data && (
        <section className="rise-in mt-4 space-y-3">
          {plan.data.note ? (
            <p className="glass rounded-2xl px-4 py-3 text-sm">{plan.data.note}</p>
          ) : null}
          {plan.data.days.map((d, i) => (
            <GlassCard key={`${d.day}-${i}`} className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-2xl bg-mint-soft text-mint">
                  <Dumbbell className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold">{d.day}</p>
                  {d.focus ? <p className="truncate text-xs text-muted-foreground">{d.focus}</p> : null}
                </div>
              </div>
              <div className="space-y-2">
                {d.exercises.map((e, j) => (
                  <div key={`${e.name}-${j}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[e.sets, e.minutes ? `${e.minutes} นาที` : "", e.note].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button
                      onClick={() => log.mutate(e)}
                      disabled={log.isPending}
                      aria-label={`บันทึก ${e.name}`}
                      className="press bg-mint-gradient grid size-9 shrink-0 place-items-center rounded-xl text-primary-foreground shadow-glow disabled:opacity-60"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </section>
      )}

      <GlassCard className="mt-4 p-4">
        <SectionTitle
          title="ประวัติการออกกำลังกาย"
          action={<History className="size-4 text-muted-foreground" />}
        />
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : history.data && history.data.length > 0 ? (
          <div className="space-y-2">
            {history.data.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{h.date} · {h.minutes} นาที</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-peach">{h.kcal} kcal</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีประวัติ — เริ่มบันทึกท่าแรกได้เลย 💪</p>
        )}
      </GlassCard>
    </div>
  );
}
