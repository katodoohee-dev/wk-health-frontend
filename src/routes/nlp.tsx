import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Save, Wand2 } from "lucide-react";
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

/** เดามื้ออาหารจากเวลาปัจจุบัน เหมือนที่หน้าสแกนอาหารใช้ ให้สอดคล้องกันทั้งแอป */
function detectSlotByTime(date = new Date()): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = date.getHours();
  if (h >= 5 && h < 10) return "breakfast";
  if (h >= 10 && h < 14) return "lunch";
  if (h >= 17 && h < 21) return "dinner";
  return "snack";
}

function NlpPage() {
  const [text, setText] = useState("");
  const [savedKeys, setSavedKeys] = useState<Set<number>>(new Set());
  const qc = useQueryClient();
  const analyze = useMutation<NlpItem[], Error, string>({
    mutationFn: (t: string) => apiNlpAnalyze(t),
    onSuccess: () => setSavedKeys(new Set()),
  });
  const items = analyze.data ?? [];
  const total = items.reduce((s, i) => s + i.kcal, 0);

  const saveOne = useMutation({
    mutationFn: (args: { item: NlpItem; index: number }) =>
      apiSaveMeal({
        foodName: args.item.name,
        calories: args.item.kcal,
        description: args.item.qty,
        slot: detectSlotByTime(),
        source: "nlp",
      }),
    onSuccess: (_data, args) => {
      setSavedKeys((prev) => new Set(prev).add(args.index));
      void qc.invalidateQueries({ queryKey: ["diary"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const unsavedItems = items.map((item, index) => ({ item, index })).filter(({ index }) => !savedKeys.has(index));

  const saveAll = useMutation({
    mutationFn: async () => {
      for (const { item, index } of unsavedItems) {
        await saveOne.mutateAsync({ item, index });
      }
    },
  });

  return (
    <div className="rise-in">
      <PageHeader title="NLP Analyze" subtitle="เล่าให้ฟังว่าวันนี้กินอะไรบ้าง" />

      <GlassCard className="p-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
          placeholder="เช่น เช้ากินข้าวต้มหมู 1 ถ้วย กับกาแฟลาเต้ 1 แก้ว…"
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground" />
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
      {saveOne.isError && <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{saveOne.error instanceof Error ? saveOne.error.message : "บันทึกอาหารไม่สำเร็จ"}</p>}

      {analyze.isSuccess && (
        <GlassCard className="rise-in mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-semibold">รายการที่แยกได้</h2>
            <span className="font-display text-xl font-bold tabular-nums text-primary">{total} <span className="text-xs font-medium text-muted-foreground">kcal</span></span>
          </div>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบรายการอาหารจากข้อความนี้ ลองอธิบายให้ละเอียดขึ้น</p>
          ) : (
            <>
              <div className="space-y-2">
                {items.map((item, i) => {
                  const isSaved = savedKeys.has(i);
                  const isSavingThis = saveOne.isPending && saveOne.variables?.index === i;
                  return (
                    <div key={`${item.name}-${i}`} className="rounded-2xl bg-muted/60 p-3">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate font-medium">{item.name}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{item.qty}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{item.kcal}</span>
                        <button
                          onClick={() => saveOne.mutate({ item, index: i })}
                          disabled={isSaved || isSavingThis}
                          aria-label={isSaved ? "บันทึกแล้ว" : `บันทึก ${item.name} ลงไดอารี`}
                          className={`press grid size-8 shrink-0 place-items-center rounded-xl ${
                            isSaved ? "bg-mint-soft text-mint" : "bg-mint-gradient text-primary-foreground"
                          } disabled:opacity-70`}
                        >
                          {isSavingThis ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : isSaved ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Save className="size-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/70">
                          <div className="h-full rounded-full bg-mint-gradient" style={{ width: `${Math.min(100, item.confidence * 100)}%` }} />
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">ความมั่นใจ {Math.round(item.confidence * 100)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {unsavedItems.length > 0 && (
                <button
                  onClick={() => saveAll.mutate()}
                  disabled={saveAll.isPending}
                  className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-mint-gradient py-3 font-medium text-primary-foreground shadow-glow disabled:opacity-60"
                >
                  {saveAll.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  บันทึกทั้งหมดลงไดอารี ({unsavedItems.length} รายการ)
                </button>
              )}
              {items.length > 0 && unsavedItems.length === 0 && (
                <p className="mt-3 rounded-2xl bg-mint-soft px-3 py-2.5 text-center text-sm text-mint">บันทึกครบทุกรายการแล้ว ✓</p>
              )}
            </>
          )}
        </GlassCard>
      )}
    </div>
  );
}
