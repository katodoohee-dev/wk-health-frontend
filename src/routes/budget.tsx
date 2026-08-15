import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { PageHeader, GlassCard, Chip } from "@/components/app/ui-bits";
import { apiBudgetPlan, type BudgetPlan } from "@/lib/api";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "วางแผนเมนูตามงบ — WK Health App" },
      { name: "description", content: "กำหนดงบต่อเดือนและเงื่อนไขสุขภาพ ระบบจัดชุดเมนูที่คุ้มค่าและดีต่อสุขภาพให้" },
      { property: "og:title", content: "วางแผนเมนูตามงบ — WK Health App" },
      { property: "og:description", content: "จัดชุดมื้ออาหารให้พอดีทั้งงบและแคลอรี" },
    ],
  }),
  component: BudgetPage,
});

const CONDITIONS = ["เบาหวาน", "ความดันสูง", "ไขมันสูง", "ลดน้ำหนัก", "เพิ่มกล้ามเนื้อ"];
const ALLERGIES = ["ถั่ว", "นมวัว", "อาหารทะเล", "ไข่", "กลูเตน"];

function BudgetPage() {
  const [monthlyBudget, setMonthlyBudget] = useState(6000);
  const [days, setDays] = useState(7);
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);

  const plan = useMutation<BudgetPlan, Error, void>({ mutationFn: () => apiBudgetPlan({ monthlyBudget, conditions, allergies, days }) });

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="rise-in">
      <PageHeader title="Budget Planner" emoji="💰" subtitle="กินดีในงบที่มี" />

      <GlassCard className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">งบต่อเดือน</p>
            <p className="font-display text-3xl font-bold tabular-nums">฿{monthlyBudget.toLocaleString()}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">เฉลี่ยต่อวัน</p>
            <p className="font-display text-2xl font-bold tabular-nums text-primary">฿{Math.round(monthlyBudget / 30)}</p>
          </div>
        </div>

        <input type="range" min={2000} max={20000} step={500} value={monthlyBudget} onChange={(e) => setMonthlyBudget(Number(e.target.value))}
          className="mt-4 w-full accent-[var(--mint)]" aria-label="ปรับงบประมาณต่อเดือน" />

        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">จำนวนวันที่ต้องการวางแผน</p>
          <div className="flex gap-2">
            {[3, 5, 7, 14].map((d) => (<Chip key={d} active={days === d} onClick={() => setDays(d)}>{d} วัน</Chip>))}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 p-5">
        <p className="mb-2 text-xs text-muted-foreground">เงื่อนไขสุขภาพ</p>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (<Chip key={c} active={conditions.includes(c)} onClick={() => toggle(conditions, setConditions, c)}>{c}</Chip>))}
        </div>
        <p className="mt-4 mb-2 text-xs text-muted-foreground">อาหารที่แพ้</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGIES.map((a) => (<Chip key={a} active={allergies.includes(a)} onClick={() => toggle(allergies, setAllergies, a)}>{a}</Chip>))}
        </div>
      </GlassCard>

      <button onClick={() => plan.mutate()} disabled={plan.isPending}
        className="press bg-mint-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-3xl py-3.5 font-medium text-primary-foreground shadow-glow disabled:opacity-60">
        {plan.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} จัดแผนเมนูให้พอดีงบ
      </button>

      {plan.isError && <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{plan.error.message}</p>}

      {plan.isSuccess && (
        <div className="rise-in mt-4 space-y-3">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display font-semibold">รวมค่าอาหารทั้งแผน</p>
              <p className="font-display text-2xl font-bold tabular-nums text-primary">฿{plan.data.totalCost.toLocaleString()}</p>
            </div>
            {plan.data.note ? <p className="mt-2 rounded-2xl bg-peach-soft p-3 text-sm">{plan.data.note}</p> : null}
          </GlassCard>

          {plan.data.days.length === 0 ? (
            <p className="glass-strong rounded-3xl p-8 text-center text-sm text-muted-foreground">ยังไม่มีแผนเมนูจากเงื่อนไขนี้</p>
          ) : (
            plan.data.days.map((d, i) => (
              <GlassCard key={`${d.day}-${i}`} className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display font-semibold">{d.day}</h2>
                  <span className="text-sm font-semibold tabular-nums text-primary">฿{d.total}</span>
                </div>
                <div className="space-y-2">
                  {d.meals.map((m, j) => (
                    <div key={`${m.name}-${j}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-background/70 text-2xl">{m.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{m.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.slot ? `${m.slot} · ` : ""}{m.kcal} kcal · โปรตีน {m.protein} g</span>
                      </span>
                      <span className="shrink-0 font-display font-bold tabular-nums">฿{m.price}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}
    </div>
  );
}
