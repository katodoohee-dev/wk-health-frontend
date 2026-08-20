import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2, Scale, Save, User, Watch } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Chip, Eyebrow, Panel, SectionHeader, SuccessState } from "@/components/app/lovable-primitives";
import { ErrorState } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiBmi, apiUpdateMe, num } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — WK Health" }, { name: "description", content: "ข้อมูลส่วนตัว เป้าหมาย และ BMI ของคุณ" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(String(user?.name ?? ""));
  const [goalKcal, setGoalKcal] = useState(String(num(user?.goalKcal ?? user?.goal_kcal, 2000)));
  const [weight, setWeight] = useState(String(num(user?.["weightKg"], 60)));
  const [height, setHeight] = useState(String(num(user?.["heightCm"], 170)));

  const bmi = useQuery({ queryKey: ["bmi", weight, height], queryFn: () => apiBmi(Number(weight), Number(height)), enabled: false });
  const save = useMutation({ mutationFn: () => apiUpdateMe({ name, goalKcal: Number(goalKcal), weightKg: Number(weight), heightCm: Number(height) }), onSuccess: (u) => { if (u) setUser(u); } });

  return (
    <AppShell>
      <div className="rise-in pb-10">
        <header className="border-b border-border py-7 sm:py-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div><Eyebrow>Account</Eyebrow><h1 className="display mt-2 text-3xl sm:text-4xl">Profile</h1><p className="mt-2 text-sm text-muted-foreground">ข้อมูลส่วนตัว เป้าหมาย และค่าพื้นฐานที่ WK ใช้เพื่อปรับสุขภาพให้เหมาะกับคุณ</p></div>
            <Chip tone="signal">Private</Chip>
          </div>
        </header>

        <section className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel className="grain">
            <div className="flex items-center gap-5">
              <div className="numeric grid size-16 shrink-0 place-items-center rounded-full border border-border text-lg sm:size-20">{(name || user?.email || "WK").slice(0,2).toUpperCase()}</div>
              <div className="min-w-0"><Eyebrow>WK Health account</Eyebrow><p className="display mt-1 truncate text-3xl">{name || user?.email || "WK Health user"}</p><p className="mt-1 text-sm text-muted-foreground">Your health profile</p></div>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Field label="Name" value={name} onChange={setName} icon={<User className="size-4" />} />
              <Field label="Daily calorie goal" value={goalKcal} onChange={setGoalKcal} type="number" />
              <Field label="Weight (kg)" value={weight} onChange={setWeight} type="number" />
              <Field label="Height (cm)" value={height} onChange={setHeight} type="number" />
            </div>
            <button onClick={() => save.mutate()} disabled={save.isPending} className="press mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-50">
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save profile
            </button>
            {save.isError ? <div className="mt-3"><ErrorState title="Save failed" body={save.error instanceof Error ? save.error.message : "Please try again."} /></div> : null}
            {save.isSuccess ? <div className="mt-3"><SuccessState title="Profile saved" body="Your updated profile is ready for the rest of WK Health." /></div> : null}
          </Panel>

          <Panel className="flex flex-col justify-between gap-8">
            <div><Eyebrow>Connected ecosystem</Eyebrow><p className="display mt-2 text-2xl">Devices & signals</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Connect supported devices to make activity, sleep and recovery signals richer.</p></div>
            <Link to="/device-connect" className="group flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-surface-2">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border"><Watch className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Connect devices</span><span className="mt-1 block text-xs text-muted-foreground">HealthKit · Google Fit · Fitbit · Garmin</span></span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Panel>
        </section>

        <section className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel>
            <SectionHeader eyebrow="Body metric" title="BMI" />
            <div className="mt-8 flex items-end gap-3"><Scale className="mb-3 size-5 text-muted-foreground"/><span className="numeric text-7xl font-medium">{bmi.data?.bmi?.toFixed(1) ?? "—"}</span><span className="pb-2 text-sm text-muted-foreground">body mass index</span></div>
            <p className="mt-4 text-sm text-muted-foreground">ใช้ค่าที่บันทึกด้านบนเพื่อคำนวณ BMI จาก API เดิมของระบบ</p>
            <button onClick={() => void bmi.refetch()} disabled={bmi.isFetching || !Number(weight) || !Number(height)} className="press mt-6 flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium disabled:opacity-50">{bmi.isFetching ? <Loader2 className="size-4 animate-spin" /> : <Scale className="size-4" />}Calculate BMI</button>
            {bmi.isError ? <div className="mt-4"><ErrorState title="BMI calculation failed" body={bmi.error instanceof Error ? bmi.error.message : "Please try again."} /></div> : null}
          </Panel>
          <Panel className="grain">
            <Eyebrow>Current classification</Eyebrow>
            <p className="display mt-2 text-3xl">{bmi.data?.classification ?? "Awaiting calculation"}</p>
            {bmi.data?.advice ? <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">{bmi.data.advice}</p> : <p className="mt-4 text-sm text-muted-foreground">คำนวณ BMI เพื่อดูคำแนะนำที่เชื่อมกับข้อมูลจริงของบัญชีคุณ</p>}
            <div className="mt-8 border-t border-border pt-5"><p className="eyebrow">Privacy</p><div className="mt-2 flex items-center gap-2 text-sm"><span className="size-1.5 rounded-full bg-foreground"/>ข้อมูลนี้เป็นข้อมูลส่วนตัวของคุณ</div></div>
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, type = "text", icon }: { label: string; value: string; onChange: (v: string) => void; type?: string; icon?: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs text-muted-foreground">{label}</span><span className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3"><span className="text-muted-foreground">{icon}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"/></span></label>;
}
