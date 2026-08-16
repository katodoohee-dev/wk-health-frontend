import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Barcode, Camera, Check, Loader2, Search, Sparkles } from "lucide-react";
import { PageHeader, GlassCard, Chip } from "@/components/app/ui-bits";
import { apiBarcode, apiCalc, apiGalleryUpload, apiScanSave, apiVision, type NutritionResult } from "@/lib/api";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "สแกนอาหาร — WK Health App" },
      { name: "description", content: "ถ่ายรูปอาหารเพื่อตรวจแคลอรีและสารอาหารอัตโนมัติด้วย AI" },
      { property: "og:title", content: "สแกนอาหาร — WK Health App" },
      { property: "og:description", content: "ถ่ายรูปอาหาร รู้แคลอรีและสารอาหารทันที" },
    ],
  }),
  component: ScanPage,
});

const SLOTS = ["มื้อเช้า", "มื้อกลางวัน", "มื้อเย็น", "ของว่าง"];

/** เดามื้ออาหารจากเวลาปัจจุบัน: 05-10 เช้า, 10-14 กลางวัน, 17-21 เย็น, นอกนั้นของว่าง */
function detectSlotByTime(date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 10) return SLOTS[0]!;
  if (h >= 10 && h < 14) return SLOTS[1]!;
  if (h >= 17 && h < 21) return SLOTS[2]!;
  return SLOTS[3]!;
}

/**
 * คิวอัปโหลดรูปแบบ persistent (localStorage) — กันรูปหายเวลาเน็ตหลุด/ปิดแอปกลางคัน
 * flow: เลือกรูป -> เข้าคิวทันที (เขียนลง localStorage ก่อนยิง network) -> ลองอัปโหลดทันที
 *       -> ถ้าพลาด อยู่ในคิวต่อ ลองใหม่อัตโนมัติเมื่อเน็ตกลับมา (event "online") หรือเปิดแอปใหม่
 */
const UPLOAD_QUEUE_KEY = "wk_pending_photo_uploads";
type QueuedUpload = { id: string; base64: string; attempts: number; createdAt: number };

function readQueue(): QueuedUpload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(UPLOAD_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedUpload[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedUpload[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(items));
  } catch {
    // localStorage เต็ม/ปิดใช้งาน — ข้ามได้ ไม่ทำให้แอปพัง
  }
}

function enqueueUpload(base64: string): QueuedUpload {
  const item: QueuedUpload = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, base64, attempts: 0, createdAt: Date.now() };
  writeQueue([...readQueue(), item]);
  return item;
}

function dequeueUpload(id: string) {
  writeQueue(readQueue().filter((i) => i.id !== id));
}

function bumpAttempts(id: string) {
  writeQueue(readQueue().map((i) => (i.id === id ? { ...i, attempts: i.attempts + 1 } : i)));
}

function ScanPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "vision" | "calc" | "save" | "barcode">(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slot, setSlot] = useState(() => detectSlotByTime());

  // สถานะอัปโหลดรูป: แยกจาก busy หลัก เพราะอัปโหลดรูปทำงานคู่ขนานกับการวิเคราะห์ AI
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "uploading" | "uploaded" | "queued" | "failed">("idle");
  const pendingIdRef = useRef<string | null>(null);

  const tryUpload = async (item: QueuedUpload): Promise<string | null> => {
    setPhotoStatus("uploading");
    try {
      const url = await apiGalleryUpload(item.base64);
      dequeueUpload(item.id);
      if (pendingIdRef.current === item.id) {
        setPhotoUrl(url);
        setPhotoStatus("uploaded");
      }
      return url;
    } catch {
      bumpAttempts(item.id);
      if (pendingIdRef.current === item.id) setPhotoStatus("queued");
      return null;
    }
  };

  // เปิดหน้ามา / เน็ตกลับมา -> ลองอัปโหลดรูปที่ค้างคิวจากรอบก่อนอัตโนมัติ (กันรูปหาย)
  useEffect(() => {
    const flush = () => {
      for (const item of readQueue()) void tryUpload(item);
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = async (file: File) => {
    setError(null); setResult(null); setSaved(false);
    setPhotoUrl(null); setPhotoStatus("idle"); pendingIdRef.current = null;
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      r.readAsDataURL(file);
    });
    setPreview(base64);

    // อัปโหลดรูปก่อนเป็นอันดับแรก (เข้าคิว persistent ทันทีกันรูปหาย) — ทำคู่ขนานกับ AI vision ด้านล่าง ไม่ต้องรอ
    const queued = enqueueUpload(base64);
    pendingIdRef.current = queued.id;
    void tryUpload(queued);

    try {
      setBusy("vision");
      const desc = await apiVision(base64);
      setDescription(desc);
      setBusy("calc");
      setResult(await apiCalc(desc));
    } catch (e) {
      setError(e instanceof Error ? e.message : "วิเคราะห์รูปไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const lookupBarcode = async () => {
    const c = code.trim();
    if (!c) return;
    setError(null); setResult(null); setSaved(false);
    try {
      setBusy("barcode");
      const r = await apiBarcode(c);
      setResult(r);
      setDescription(`บาร์โค้ด ${c}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่พบข้อมูลสินค้าจากบาร์โค้ดนี้");
    } finally {
      setBusy(null);
    }
  };

  const save = async (opts: { skipPhoto?: boolean } = {}) => {
    if (!result) return;
    setError(null);
    try {
      setBusy("save");
      let finalPhotoUrl = photoUrl ?? undefined;

      // ถ้ารูปยังอัปโหลดไม่เสร็จ (uploading/queued) และผู้ใช้ไม่ได้เลือกข้ามรูป -> ลองอัปโหลดอีกครั้งก่อนบันทึก
      if (!finalPhotoUrl && !opts.skipPhoto && pendingIdRef.current) {
        const pending = readQueue().find((i) => i.id === pendingIdRef.current);
        if (pending) {
          const retried = await tryUpload(pending);
          if (retried) finalPhotoUrl = retried;
        }
      }

      if (!finalPhotoUrl && !opts.skipPhoto && photoStatus !== "idle") {
        setError('รูปยังอัปโหลดไม่สำเร็จ — ลองใหม่อีกครั้ง หรือกด "บันทึกโดยไม่มีรูป" ด้านล่าง');
        setBusy(null);
        return;
      }

      await apiScanSave({ ...result, description, slot, meal: slot, photoUrl: finalPhotoUrl });
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ["diary"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
      void qc.invalidateQueries({ queryKey: ["gallery"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rise-in">
      <PageHeader title="สแกนอาหาร" emoji="📸" subtitle="ถ่ายรูปหรือเลือกจากคลังภาพ" />

      <GlassCard className="overflow-hidden p-0">
        <div className="relative aspect-4/5 w-full sm:aspect-video">
          <div className="bg-hero absolute inset-0" />
          {preview ? (
            <img src={preview} alt="รูปอาหารที่เลือก" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center"><span className="text-7xl drop-shadow-sm">🍽️</span></div>
          )}
          <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-background/70">
            {busy && <div className="absolute inset-x-0 top-0 h-1 animate-[rise-in_1.2s_ease-in-out_infinite_alternate] rounded-full bg-primary shadow-glow" />}
          </div>
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="glass rounded-full px-3 py-1 text-xs font-medium">AI Vision</span>
            {busy && (
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                {busy === "vision" ? "กำลังอ่านรูป…" : busy === "calc" ? "กำลังคำนวณ…" : busy === "barcode" ? "กำลังค้นบาร์โค้ด…" : "กำลังบันทึก…"}
              </span>
            )}
          </div>
        </div>

        <div className="grid place-items-center gap-3 p-4">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}
            className="press bg-mint-gradient grid size-16 place-items-center rounded-full text-primary-foreground shadow-glow disabled:opacity-60" aria-label="เลือก/ถ่ายรูปอาหาร">
            {busy ? <Loader2 className="size-7 animate-spin" /> : <Camera className="size-7" />}
          </button>
          <p className="text-xs text-muted-foreground">แตะเพื่อถ่ายรูปหรือเลือกจากคลังภาพ</p>
        </div>
      </GlassCard>

      <div className="mt-4">
        <button onClick={() => setBarcodeOpen((v) => !v)} className="press glass-strong flex w-full items-center gap-3 rounded-3xl p-4 shadow-soft">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-soft text-sky"><Barcode className="size-5" /></span>
          <span className="min-w-0 text-left">
            <span className="block truncate font-display font-semibold">สแกนบาร์โค้ด</span>
            <span className="block truncate text-xs text-muted-foreground">ค้นข้อมูลโภชนาการจากฐาน OpenFoodFacts</span>
          </span>
        </button>

        {barcodeOpen && (
          <div className="rise-in mt-2 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="กรอกเลขบาร์โค้ด เช่น 8850002000018"
              className="glass min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none" aria-label="เลขบาร์โค้ด" />
            <button onClick={() => void lookupBarcode()} disabled={Boolean(busy) || !code.trim()}
              className="press bg-mint-gradient flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
              {busy === "barcode" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} ค้นหา
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {SLOTS.map((s) => (<Chip key={s} active={slot === s} onClick={() => setSlot(s)}>{s}</Chip>))}
      </div>

      {error && <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {result && (
        <div className="rise-in mt-4 space-y-3">
          <GlassCard className="p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">ผลการวิเคราะห์</p>
                <h2 className="truncate font-display text-xl font-bold">{result.name}</h2>
              </div>
              <p className="shrink-0 font-display text-3xl font-bold tabular-nums text-primary">
                {result.kcal}<span className="ml-1 text-sm font-medium text-muted-foreground">kcal</span>
              </p>
            </div>
            {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[{ l: "โปรตีน", v: result.protein, c: "bg-mint-soft" }, { l: "คาร์บ", v: result.carb, c: "bg-sky-soft" }, { l: "ไขมัน", v: result.fat, c: "bg-peach-soft" }].map((m) => (
                <div key={m.l} className={`rounded-2xl ${m.c} py-3`}>
                  <p className="font-display text-lg font-bold tabular-nums">{m.v}g</p>
                  <p className="text-[11px] text-muted-foreground">{m.l}</p>
                </div>
              ))}
            </div>
            {result.items.length > 0 && (
              <div className="mt-4 space-y-2">
                {result.items.map((it, i) => (
                  <div key={`${it.label}-${i}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{it.label}</span>
                    {it.grams ? <span className="shrink-0 text-xs text-muted-foreground">{it.grams} g</span> : null}
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{it.kcal}</span>
                  </div>
                ))}
              </div>
            )}
            {result.tips && (
              <p className="mt-4 flex gap-2 rounded-2xl bg-peach-soft p-3 text-sm">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-peach" /><span>{result.tips}</span>
              </p>
            )}
            {photoStatus === "uploading" && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> กำลังอัปโหลดรูป…</p>
            )}
            {photoStatus === "queued" && (
              <p className="mt-3 text-xs text-peach">อัปโหลดรูปยังไม่สำเร็จ (จะลองใหม่อัตโนมัติเมื่อเน็ตกลับมา หรือกดบันทึกอีกครั้งเพื่อลองทันที)</p>
            )}
            {photoStatus === "uploaded" && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-mint"><Check className="size-3.5" /> อัปโหลดรูปสำเร็จแล้ว</p>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => void save()} disabled={Boolean(busy) || saved}
                className="press bg-mint-gradient flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 font-medium text-primary-foreground shadow-glow disabled:opacity-60">
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {saved ? "บันทึกแล้ว" : "บันทึกลงไดอารี"}
              </button>
              <button onClick={() => { setResult(null); setPreview(null); setSaved(false); setDescription(""); setPhotoUrl(null); setPhotoStatus("idle"); pendingIdRef.current = null; }} className="press glass rounded-2xl px-4 py-3 text-sm font-medium">
                สแกนใหม่
              </button>
            </div>
            {photoStatus === "queued" && !saved && (
              <button onClick={() => void save({ skipPhoto: true })} disabled={Boolean(busy)}
                className="press mt-2 w-full rounded-2xl py-2.5 text-xs font-medium text-muted-foreground underline underline-offset-2 disabled:opacity-60">
                บันทึกโดยไม่มีรูป (รูปจะลองอัปโหลดใหม่อัตโนมัติในพื้นหลัง)
              </button>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
