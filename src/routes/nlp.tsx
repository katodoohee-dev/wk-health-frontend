import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Wand2 } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { apiNlpAnalyze, type NlpItem } from "@/lib/api";
import { apiSaveMeal } from "@/lib/meal-save";

export const Route = createFileRoute("/nlp")({
  head: () => ({
    meta: [
      { title: "วิเคราะห์ข้อความอาหาร (NLP) — WK Health App" },
      { name: "description", content: "พิมพ์บรรยายสิ่งที่กิน แล้วให้ AI แยกรายการอาหารและคำนวณแคลอรีให้อัตโนมัติ" },
      { property: "og:title", content: "วิเคราะห์ข้อความอาหาร (NLP) — WK Health App" },
      { property: "og:description", content: "พิมพ์บรรยายอาหาร แล้วรู้แคลอรีทันที" },
    ],
  }),
  component: NlpPage,
});

const SLOTS = ["มื้อเช้า", "มื้อกลางวัน", "มื้อเย็น", "ของว่าง"];

function detectSlotByTime(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 10) return SLOTS[0]!;
  if (h >= 10 && h < 14) return SLOTS[1]!;
  if (h >= 17 && h < 21) return SLOTS[2]!;
  return SLOTS[3]!;
}

function NlpPage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [slot, setSlot] = useState(detectSlotByTime());
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const analyze = useMutation<NlpItem[], Error, string>({ mutationFn: (t: string) => apiNlpAnalyze(t) });
  const items = analyze.data ?? [];
  const total = items.reduce((s, i) => s + i.kcal, 0);

  const saveItem = async (item: NlpItem, index: number) => {
    setSaveError(null);
    try {
      await apiSaveMeal({ name: item.name, kcal: item.kcal, slot, description: text, source: "nlp" });
      setSaved((v) => ({ ...v, [index]: true }));
      void qc.invalidateQueries({ queryKey: ["diary"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "บันทึกเมนูไม่สำเร็จ");
    }
  };

  const saveAll = async () => {
    setSaveError(null);
    try {
      for (let i = 0; i < items.length; i += 1) {
        if (!saved[i]) await apiSaveMeal({ name: items[i]!.name, kcal: items[i]!.kcal, slot, description: text, source: "nlp" });
      }
      setSaved(Object.fromEntries(items.map((_, i) => [i, true])));
      void qc.invalidateQueries({ queryKey: ["diary"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "บันทึกบางรายการไม่สำเร็จ");
    }
  };

  return (
    <div className="rise-in">
      <PageHeader title="NLP Analyze" emoji="🧠" subtitle="เล่าให้ฟังว่าวันนี้กินอะไรบ้าง" />

      <GlassCard className="p-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
          placeholder="เช่น เช้ากินข้าวต้มหมู 1 ถ้วย กับกาแฟลาเต้ 1 แก้ว…"
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground" />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {SLOTS.map((s) => <button key={s} onClick={() => setSlot(s)} className={`press rounded-full px-3 py-1.5 text-xs ${slot === s ? "bg-mint-gradient text-primary-foreground" : "glass text-muted-foreground"}`}>{s}</button>)}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => text.trim() && analyze.mutate(text.trim())} disabled={analyze.isPending || !text.trim()}
            className="press bg-mint-gradient flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 font-medium text-primary-foreground shadow-glow disabled:opacity-60">
            {analyze.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} วิเคราะห์ข้อความ
          </button>
        </div>
      </GlassCard>

      <div className="mt-3 flex flex-wrap gap-2">
        {["ข้าวมันไก่ 1 จาน", "นมถั่วเหลือง 1 กล่อง", "ผัดไทยกุ้งสด", "โจ๊กหมู 1 ถ้วย"].map((s) => (
          <button key={s} onClick={() => setText(s)} className="press glass rounded-full px-3.5 py-2 text-xs font-medium text-muted-foreground">{s}</button>
        ))}
      </div>

      {analyze.isError && <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{analyze.error.message}</p>}
      {saveError && <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{saveError}</p>}

      {analyze.isSuccess && (
        <GlassCard className="rise-in mt-4 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold">รายการที่แยกได้</h2>
            <span className="font-display text-xl font-bold tabular-nums text-primary">{total} <span className="text-xs font-medium text-muted-foreground">kcal</span></span>
          </div>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบรายการอาหารจากข้อความนี้ ลองอธิบายให้ละเอียดขึ้น</p>
          ) : (
            <>
              <div className="mb-3 flex justify-end">
                <button onClick={() => void saveAll()} disabled={items.every((_, i) => saved[i])}
                  className="press rounded-2xl bg-mint-gradient px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
                  บันทึกทั้งหมด
                </button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={`${item.name}-${i}`} className="rounded-2xl bg-muted/60 p-3">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-medium">{item.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{item.qty}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{item.kcal}</span>
                      <button onClick={() => void saveItem(item, i)} disabled={saved[i]} aria-label={`บันทึก ${item.name}`}
                        className="press grid size-8 shrink-0 place-items-center rounded-xl bg-background/70 text-primary disabled:opacity-70">
                        {saved[i] ? <Check className="size-4" /> : <span className="text-sm">＋</span>}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/70">
                        <div className="h-full rounded-full bg-mint-gradient" style={{ width: `${Math.min(100, item.confidence * 100)}%` }} />
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">ความมั่นใจ {Math.round(item.confidence * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </GlassCard>
      )}
    </div>
  );
}
