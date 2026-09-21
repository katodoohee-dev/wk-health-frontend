/**
 * สร้างรูปแชร์ "สถิติการวิ่ง" ตามดีไซน์ที่ผู้ใช้ส่งมา (การ์ดดำโค้งมนด้านบน + เส้นทางจริงจาก GPS ด้านล่าง)
 * - ตัวเลข Dist/Time/Pace ดึงจากข้อมูลจริงที่บันทึกไว้ตอนจบการวิ่ง (แม่นยำ ไม่ปัดเพี้ยน)
 * - เส้นทางวาดจากพิกัด GPS จริงทั้งเส้น (ไม่ใช่เส้นสุ่ม) โปรเจกต์แบบ equirectangular ง่ายๆ
 *   (แม่นยำพอสำหรับระยะวิ่ง/เดินทั่วไปที่ไม่กว้างเกินสิบกิโลเมตร) แล้วสเกลให้พอดีพื้นที่วาด
 * - เลือกสีเส้นได้ (ส่งมาจาก <input type="color"> ซึ่งเปิดเป็นวงล้อสีบน Android/Chrome อยู่แล้ว)
 * - ใส่พื้นหลังเองได้ (รูปที่ผู้ใช้อัปโหลด, cover-fit เต็มจอ) ถ้าไม่ใส่ใช้พื้นขาวตามดีไซน์ต้นแบบ
 * - ฝัง badge ชื่อเว็บ + QR code เหมือนรูปแชร์สรุปสัปดาห์ ให้เปิดเว็บได้จากรูปเสมอ
 */

export interface RunSharePoint {
  lat: number;
  lng: number;
}

export interface RunShareOptions {
  distanceKm: number;
  durationSeconds: number;
  path: RunSharePoint[];
  lineColor?: string; // hex เช่น "#e0201a" ค่า default แดงตามดีไซน์ต้นแบบ
  backgroundImage?: HTMLImageElement | null;
  date?: Date;
}

const WIDTH = 1080;
const HEIGHT = 1920; // อัตราส่วน IG Story (9:16) พอดี

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

async function loadQrImage(url: string, sizePx = 240): Promise<HTMLImageElement | null> {
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&margin=0&data=${encodeURIComponent(url)}`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("โหลด QR ไม่สำเร็จ"));
      img.src = qrUrl;
    });
    return img;
  } catch {
    return null;
  }
}

/** อ่านไฟล์รูปที่ผู้ใช้อัปโหลดเป็น HTMLImageElement (ทำในเครื่องล้วนๆ ไม่อัปโหลดขึ้น server) */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("ไฟล์รูปนี้เปิดไม่ได้"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

/** ฟอร์แมตเวลาให้ตรงดีไซน์ต้นแบบ (นาที.วินาที เช่น 32.19) — คำนวณจากวินาทีจริงตรงๆ ไม่ปัดเพี้ยน */
export function formatRunTime(durationSeconds: number): string {
  const mm = Math.floor(durationSeconds / 60);
  const ss = Math.floor(durationSeconds % 60);
  return `${mm}.${String(ss).padStart(2, "0")}`;
}

/** ฟอร์แมต pace เป็น M:SS ต่อกม. — กันเคส distanceKm เป็น 0 (หารไม่ได้) และกันเคส ss ปัดเป็น 60 */
export function formatRunPace(durationSeconds: number, distanceKm: number): string {
  if (!distanceKm || distanceKm <= 0) return "-:--";
  const paceSecTotal = durationSeconds / distanceKm;
  let paceMin = Math.floor(paceSecTotal / 60);
  let paceSec = Math.round(paceSecTotal - paceMin * 60);
  if (paceSec === 60) {
    paceMin += 1;
    paceSec = 0;
  }
  return `${paceMin}:${String(paceSec).padStart(2, "0")}`;
}

export async function renderRunShareImage(opts: RunShareOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("สร้างรูปไม่สำเร็จ (canvas ไม่รองรับ)");

  // พื้นหลัง: รูปที่อัปโหลดเอง (cover-fit) หรือพื้นขาวตามดีไซน์ต้นแบบ
  if (opts.backgroundImage) {
    drawImageCover(ctx, opts.backgroundImage, 0, 0, WIDTH, HEIGHT);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // การ์ดสถิติสีเข้มโค้งมน (ตามดีไซน์ต้นแบบ)
  const cardX = 64;
  const cardY = 110;
  const cardW = WIDTH - cardX * 2;
  const cardH = 340;
  ctx.fillStyle = "rgba(18,18,20,0.95)";
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "500 30px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("WK RUNNER", cardX + 44, cardY + 74);
  ctx.textAlign = "right";
  const dateStr = (opts.date ?? new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  ctx.fillText(dateStr, cardX + cardW - 44, cardY + 74);

  ctx.fillStyle = "#ffffff";
  ctx.font = "500 62px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Dist ${opts.distanceKm.toFixed(2)} KM`, cardX + 44, cardY + 190);
  ctx.textAlign = "right";
  ctx.fillText(`TIME ${formatRunTime(opts.durationSeconds)}`, cardX + cardW - 44, cardY + 190);

  ctx.textAlign = "center";
  ctx.font = "500 62px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(`PACE ${formatRunPace(opts.durationSeconds, opts.distanceKm)}`, cardX + cardW / 2, cardY + 300);

  // เส้นทางจริงจาก GPS — โปรเจกต์ equirectangular ง่ายๆ (x = lng*cos(lat), y = lat) แล้วสเกลให้พอดี
  const pathAreaX = 90;
  const pathAreaY = cardY + cardH + 90;
  const pathAreaW = WIDTH - pathAreaX * 2;
  const pathAreaH = 1000;
  const lineColor = opts.lineColor || "#e0201a";

  if (opts.path.length >= 2) {
    const lats = opts.path.map((p) => p.lat);
    const lngs = opts.path.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

    const xs = lngs.map((lng) => (lng - minLng) * cosLat);
    const ys = lats.map((lat) => lat - minLat);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1e-6;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1e-6;
    const minX = Math.min(...xs);
    const scale = Math.min(pathAreaW / spanX, pathAreaH / spanY) * 0.82; // เหลือขอบไว้ 18%
    const drawW = spanX * scale;
    const drawH = spanY * scale;
    const offsetX = pathAreaX + (pathAreaW - drawW) / 2;
    const offsetY = pathAreaY + (pathAreaH - drawH) / 2;

    const toScreen = (i: number) => ({
      x: offsetX + (xs[i]! - minX) * scale,
      y: offsetY + drawH - ys[i]! * scale, // flip แกน y (เหนือ = บน) — ys อ้างอิงจาก minLat แล้ว จึงเริ่มที่ 0 เสมอ
    });

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 18;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    opts.path.forEach((_, i) => {
      const { x, y } = toScreen(i);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // จุดเริ่มต้น (blob กลมใหญ่ ตามดีไซน์ต้นแบบ)
    const start = toScreen(0);
    ctx.beginPath();
    ctx.arc(start.x, start.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  // FIX: ฝัง URL ไปพร้อมรูปตามที่ขอ — badge ชื่อเว็บ + QR สแกนเปิดเว็บ (แบบเดียวกับรูปสรุปสัปดาห์)
  const siteUrl = typeof window !== "undefined" ? window.location.host : "wk-health-frontend.onrender.com";
  const isDarkBg = !!opts.backgroundImage; // มีรูปพื้นหลังเอง เดาว่าอาจเข้มกว่าเดิม ใช้ badge โปร่งเข้มเสมอ ให้อ่านง่ายไม่ว่าพื้นหลังจะเป็นสีอะไร
  const badgePadX = 22;
  const badgeH = 52;
  ctx.font = "600 26px 'Segoe UI', system-ui, sans-serif";
  const badgeTextW = ctx.measureText(siteUrl).width;
  const badgeW = badgeTextW + badgePadX * 2 + 34;
  ctx.fillStyle = isDarkBg ? "rgba(0,0,0,0.45)" : "rgba(15,23,42,0.85)";
  const badgeY = HEIGHT - 90;
  roundRect(ctx, WIDTH / 2 - badgeW / 2, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(WIDTH / 2 - badgeW / 2 + badgePadX + 10, badgeY + badgeH / 2, 8, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(siteUrl, WIDTH / 2 - badgeW / 2 + badgePadX + 30, badgeY + badgeH / 2 + 9);

  const qrSize = 210;
  const qrImg = await loadQrImage(`https://${siteUrl}`, qrSize * 2);
  if (qrImg) {
    const qrBoxPad = 18;
    const qrBoxSize = qrSize + qrBoxPad * 2;
    const qrX = WIDTH / 2 - qrBoxSize / 2;
    const qrY = badgeY - qrBoxSize - 30;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 22);
    ctx.fill();
    ctx.drawImage(qrImg, qrX + qrBoxPad, qrY + qrBoxPad, qrSize, qrSize);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("สร้างรูปไม่สำเร็จ"));
    }, "image/png");
  });
}

/** วาดพรีวิวลง canvas element ที่มีอยู่แล้วโดยตรง (สำหรับแสดงตัวอย่างสดในหน้าจอก่อนกดแชร์จริง) */
export async function renderRunSharePreview(canvas: HTMLCanvasElement, opts: RunShareOptions) {
  const blob = await renderRunShareImage(opts);
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("โหลดพรีวิวไม่สำเร็จ"));
    img.src = url;
  });
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  return blob;
}
