import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, Image as ImageIcon, Loader2, Search, Square, Save } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { useAuth } from "@/lib/auth";
import { apiSaveMeal } from "@/lib/meal-save";

export const Route = createFileRoute("/barcode")({
  head: () => ({
    meta: [
      { title: "สแกนบาร์โค้ด — WK Health App" },
      { name: "description", content: "สแกนบาร์โค้ดจากกล้องหรือรูปภาพเพื่อค้นหาโภชนาการและบันทึกเมนู" },
    ],
  }),
  component: BarcodePage,
});

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

type BarcodeDetectorLike = {
  detect(source: ImageBitmap | HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
};

type Product = {
  barcode: string;
  name: string;
  brand: string;
  image?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
  fiber: number;
};

function n(value: unknown) {
  const x = Number(value);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

async function lookupBarcode(barcode: string): Promise<Product> {
  const clean = barcode.replace(/\D/g, "");
  if (!clean) throw new Error("ไม่พบเลขบาร์โค้ด");
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json?fields=product_name,brands,nutriments,image_front_small_url`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.status !== 1 || !data?.product) {
    throw new Error("ไม่พบสินค้าจากบาร์โค้ดนี้ในฐานข้อมูล Open Food Facts");
  }
  const p = data.product;
  const q = p.nutriments ?? {};
  return {
    barcode: clean,
    name: String(p.product_name || "สินค้าไม่ระบุชื่อ").trim(),
    brand: String(p.brands || "").split(",")[0].trim(),
    image: p.image_front_small_url,
    kcal: n(q["energy-kcal_100g"] ?? q["energy-kcal"]),
    protein: n(q.proteins_100g),
    carbs: n(q.carbohydrates_100g),
    fat: n(q.fat_100g),
    sodium: n(q.sodium_100g) * 1000,
    fiber: n(q.fiber_100g),
  };
}

function BarcodePage() {
  const { isAuthenticated } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [grams, setGrams] = useState(100);
  const [slot, setSlot] = useState("snack");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const stopCamera = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  const processBarcode = async (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) return;
    stopCamera();
    setBarcode(clean);
    setBusy(true);
    setMessage("");
    try {
      setProduct(await lookupBarcode(clean));
    } catch (error) {
      setProduct(null);
      setMessage(error instanceof Error ? error.message : "ค้นหาสินค้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    setMessage("");
    if (!window.BarcodeDetector) {
      setMessage("เบราว์เซอร์นี้ยังไม่รองรับการสแกนบาร์โค้ดผ่านกล้อง ให้ใช้ปุ่มเลือกรูปภาพแทน หรือเปิดด้วย Chrome/Edge รุ่นใหม่");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"] });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          const value = found.find((x) => x.rawValue)?.rawValue;
          if (value) {
            await processBarcode(value);
            return;
          }
        } catch {
          // Keep scanning; camera frames can occasionally fail while autofocus changes.
        }
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch (error) {
      stopCamera();
      setMessage(error instanceof Error ? error.message : "เปิดกล้องไม่ได้ กรุณาอนุญาตสิทธิ์กล้อง");
    }
  };

  const onImage = async (file?: File) => {
    if (!file) return;
    setMessage("");
    if (!window.BarcodeDetector) {
      setMessage("เบราว์เซอร์นี้ไม่รองรับการอ่านบาร์โค้ดจากรูปโดยตรง ให้ใช้ Chrome/Edge รุ่นใหม่ หรือกรอกเลขบาร์โค้ดเอง");
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"] });
      const found = await detector.detect(bitmap);
      bitmap.close();
      const value = found.find((x) => x.rawValue)?.rawValue;
      if (!value) throw new Error("อ่านบาร์โค้ดจากรูปไม่สำเร็จ ลองถ่ายให้เส้นบาร์โค้ดคมและตรงขึ้น");
      await processBarcode(value);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อ่านบาร์โค้ดจากรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const factor = grams / 100;
  const save = async () => {
    if (!product || !isAuthenticated) return;
    setBusy(true);
    setMessage("");
    try {
      await apiSaveMeal({
        name: product.name,
        kcal: Math.round(product.kcal * factor),
        protein: Number((product.protein * factor).toFixed(1)),
        carb: Number((product.carbs * factor).toFixed(1)),
        fat: Number((product.fat * factor).toFixed(1)),
        sodium: Number((product.sodium * factor).toFixed(1)),
        fiber: Number((product.fiber * factor).toFixed(1)),
        slot,
        source: "barcode",
        description: `บาร์โค้ด ${product.barcode}${product.brand ? ` · ${product.brand}` : ""} · ${grams} g`,
        photoUrl: product.image ?? null,
      });
      setMessage("บันทึกเมนูลงไดอารีเรียบร้อยแล้ว ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกเมนูไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rise-in">
      <PageHeader title="สแกนบาร์โค้ด" emoji="📦" subtitle="ใช้กล้องหรือเลือกรูปบาร์โค้ดจากเครื่อง" />
      <GlassCard className="p-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={cameraOn ? stopCamera : startCamera} className="press bg-mint-gradient flex items-center justify-center gap-2 rounded-2xl py-3 font-medium text-primary-foreground shadow-glow">
            {cameraOn ? <Square className="size-4" /> : <Camera className="size-4" />} {cameraOn ? "หยุดกล้อง" : "เปิดกล้อง"}
          </button>
          <label className="press glass flex cursor-pointer items-center justify-center gap-2 rounded-2xl py-3 font-medium">
            <ImageIcon className="size-4" /> เลือกรูปภาพ
            <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => void onImage(e.target.files?.[0])} />
          </label>
        </div>
        <div className="mt-3 overflow-hidden rounded-3xl bg-black">
          <video ref={videoRef} className={`aspect-video w-full object-cover ${cameraOn ? "block" : "hidden"}`} playsInline muted />
          {!cameraOn && <div className="flex aspect-video items-center justify-center text-sm text-white/60">กด “เปิดกล้อง” หรือ “เลือกรูปภาพ”</div>}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="หรือกรอกเลขบาร์โค้ดเอง" className="min-w-0 flex-1 rounded-2xl bg-muted/60 px-4 py-3 text-sm outline-none" />
          <button disabled={busy || !barcode} onClick={() => void processBarcode(barcode)} className="press rounded-2xl bg-muted px-4 disabled:opacity-50"><Search className="size-5" /></button>
        </div>
      </GlassCard>

      {busy && <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> กำลังค้นหา…</div>}
      {message && <p className="mt-4 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{message}</p>}

      {product && (
        <GlassCard className="rise-in mt-4 p-4">
          <div className="flex gap-3">
            {product.image ? <img src={product.image} alt="" className="size-20 shrink-0 rounded-2xl object-cover" /> : <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-muted text-2xl">📦</div>}
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-semibold">{product.name}</h2>
              {product.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
              <p className="mt-1 text-xs text-muted-foreground">บาร์โค้ด {product.barcode} · ข้อมูลโภชนาการต่อ 100 g</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Stat label="พลังงาน" value={`${Math.round(product.kcal * factor)} kcal`} />
            <Stat label="โปรตีน" value={`${(product.protein * factor).toFixed(1)} g`} />
            <Stat label="คาร์บ" value={`${(product.carbs * factor).toFixed(1)} g`} />
            <Stat label="ไขมัน" value={`${(product.fat * factor).toFixed(1)} g`} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="rounded-2xl bg-muted/60 px-3 py-2 text-xs">ปริมาณ (g)<input type="number" min="1" max="5000" value={grams} onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full bg-transparent text-base font-semibold outline-none" /></label>
            <label className="rounded-2xl bg-muted/60 px-3 py-2 text-xs">มื้อ<select value={slot} onChange={(e) => setSlot(e.target.value)} className="mt-1 w-full bg-transparent text-base font-semibold outline-none"><option value="breakfast">มื้อเช้า</option><option value="lunch">มื้อกลางวัน</option><option value="dinner">มื้อเย็น</option><option value="snack">ของว่าง</option></select></label>
          </div>
          <button disabled={busy || !isAuthenticated} onClick={() => void save()} className="press bg-mint-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-primary-foreground shadow-glow disabled:opacity-50"><Save className="size-4" /> บันทึกเมนูลงไดอารี</button>
        </GlassCard>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-muted/50 px-3 py-2"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold tabular-nums">{value}</p></div>;
}
