import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Scale, Save, User, Watch, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageHeader, GlassCard, SectionTitle } from "@/components/app/ui-bits";
import { useAuth } from "@/lib/auth";
import { apiBmi, apiUpdateMe, num } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "โปรไฟล์ & BMI — WK Health App" },
      { name: "description", content: "จัดการโปรไฟล์ เป้าหมายแคลอรี และคำนวณค่าดัชนีมวลกาย (BMI) พร้อมคำแนะนำ" },
      { property: "og:title", content: "โปรไฟล์ & BMI — WK Health App" },
      { property: "og:description", content: "คำนวณ BMI และตั้งเป้าหมายแคลอรีของคุณ" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(String(user?.name ?? ""));
  const [goalKcal, setGoalKcal] = useState(String(num(user?.goalKcal ?? user?.goal_kcal, 2000)));
  const [weight, setWeight] = useState(String(num(user?.["weightKg"], 60)));
  const [height, setHeight] = useState(String(num(user?.["heightCm"], 170)));

  const bmi = useQuery({ queryKey: ["bmi", weight, height], queryFn: () => apiBmi(Number(weight), Number(height)), enabled: false });

  const save = useMutation({
    mutationFn: () => apiUpdateMe({ name, goalKcal: Number(goalKcal), weightKg: Number(weight), heightCm: Number(height) }),
    onSuccess: (u) => { if (u) setUser(u); },
  });

  return (
    <div className="rise-in">
      <PageHeader title="โปรไฟล์" emoji="👤" subtitle="ข้อมูลส่วนตัวและ BMI" />

      <GlassCard className="p-5">
        <SectionTitle title="ข้อมูลของฉัน" />
        <div className="space-y-3">
          <Field label="ชื่อ" value={name} onChange={setName} icon={<User className="size-4" />} />
          <Field label="เป้าหมายแคลอรี (kcal/วัน)" value={goalKcal} onChange={setGoalKcal} type="number" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="น้ำหนัก (กก.)" value={weight} onChange={setWeight} type="number" />
            <Field label="ส่วนสูง (ซม.)" value={height} onChange={setHeight} type="number" />
          </div>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="press bg-mint-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} บันทึกโปรไฟล์
          </button>
          {save.isError && <p className="rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{save.error instanceof Error ? save.error.message : "บันทึกไม่สำเร็จ"}</p>}
          {save.isSuccess && <p className="text-xs text-primary">บันทึกโปรไฟล์แล้ว ✓</p>}
        </div>
      </GlassCard>

      <Link to="/device-connect" className="press block">
        <GlassCard className="mt-4 flex items-center gap-3 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint-soft text-mint">
            <Watch className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">เชื่อมต่ออุปกรณ์</p>
            <p className="truncate text-xs text-muted-foreground">HealthKit, Google Fit, Fitbit, Garmin</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </GlassCard>
      </Link>

      <GlassCard className="mt-4 p-5">
        <SectionTitle title="คำนวณ BMI" />
        <p className="text-xs text-muted-foreground">ใช้ค่าน้ำหนัก/ส่วนสูงด้านบนในการคำนวณดัชนีมวลกาย</p>
        <button onClick={() => void bmi.refetch()} disabled={bmi.isFetching || !Number(weight) || !Number(height)}
          className="press glass mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium disabled:opacity-60">
          {bmi.isFetching ? <Loader2 className="size-4 animate-spin" /> : <Scale className="size-4" />} คำนวณ BMI
        </button>

        {bmi.isError && <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{bmi.error instanceof Error ? bmi.error.message : "คำนวณไม่สำเร็จ"}</p>}

        {bmi.data && (
          <div className="rise-in mt-4 rounded-3xl bg-mint-soft p-5 text-center">
            <p className="text-xs text-muted-foreground">ค่า BMI ของคุณ</p>
            <p className="font-display text-5xl font-bold tabular-nums text-primary">{bmi.data.bmi.toFixed(1)}</p>
            <p className="mt-1 font-display text-lg font-semibold">{bmi.data.classification}</p>
            {bmi.data.advice ? <p className="mt-2 text-sm text-muted-foreground">{bmi.data.advice}</p> : null}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", icon }: { label: string; value: string; onChange: (v: string) => void; type?: string; icon?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <span className="glass flex items-center gap-2 rounded-2xl px-3">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
      </span>
    </label>
  );
}
