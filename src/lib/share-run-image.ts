/**
 * สร้างรูปแชร์ "สถิติการวิ่ง" ตามดีไซน์ที่ผู้ใช้ส่งมา (การ์ดดำโค้งมนด้านบน + เส้นทางจริงจาก GPS ด้านล่าง)
 * - ตัวเลข Dist/Time/Pace ดึงจากข้อมูลจริงที่บันทึกไว้ตอนจบการวิ่ง (แม่นยำ ไม่ปัดเพี้ยน)
 * - เส้นทางวาดจากพิกัด GPS จริงทั้งเส้น (ไม่ใช่เส้นสุ่ม) โปรเจกต์แบบ equirectangular ง่ายๆ
 *   (แม่นยำพอสำหรับระยะวิ่ง/เดินทั่วไปที่ไม่กว้างเกินสิบกิโลเมตร) แล้วสเกลให้พอดีพื้นที่วาด
 * - เลือกสีเส้นได้ (ส่งมาจาก <input type="color"> ซึ่งเปิดเป็นวงล้อสีบน Android/Chrome อยู่แล้ว)
 * - ใส่พื้นหลังเองได้ (รูปที่ผู้ใช้อัปโหลด, cover-fit เต็มจอ) ถ้าไม่ใส่ใช้พื้นขาวตามดีไซน์ต้นแบบ
 * - ฝัง badge ชื่อเว็บ + QR code เหมือนรูปแชร์สรุปสัปดาห์ ให้เปิดเว็บได้จากรูปเสมอ
 *
 * FIX: เพิ่มใหม่ตามที่ขอ —
 * 1) เส้นทางวาดแบบ "3D" ยกตัวขึ้นมาเป็นเส้นมีความสูง: มีชั้นเงาใต้เส้น (extrusion) ไล่สีเข้ม
 *    ให้ความรู้สึกเป็นท่อ/สันเขาที่ยกตัวขึ้นจากพื้น + ไฮไลต์บนเส้นด้านบนให้ดูมีมิติ สีที่เลือกเอง
 *    (lineColor) จะถูกไล่โทนอ่อน/เข้มอัตโนมัติให้เข้าธีม 3D นี้ ไม่ต้องเลือกสีเพิ่ม
 * 2) ดึงแผนที่จริงย่อๆ ของบริเวณที่วิ่ง (OSM raster tile) มาแปะเป็นพื้นหลังใต้เส้นทาง แทนพื้นขาว/ว่างๆ
 *    เดิม — ถ้าโหลด tile ไม่สำเร็จ (เช่นเน็ตช้า/ติด CORS) จะ fallback กลับไปใช้พื้นเดิมแบบเงียบๆ
 *    ไม่ทำให้สร้างรูปพัง
 */

import { DEFAULT_LIGHTNING_COLORS, hexToRgb, type LightningColors } from "./share-image";

export type { LightningColors };
export { DEFAULT_LIGHTNING_COLORS };

export interface RunSharePoint {
  lat: number;
  lng: number;
}

// FIX: เพิ่มใหม่ตามที่ขอ — เอฟเฟกต์ "สายฟ้าเกาะเส้นทาง" วาดแขนงฟ้าผ่าแบบ fractal (หักมุมสุ่มไปเรื่อยๆ
// แตกกิ่งย่อยได้) แยกออกจากจุดต่างๆ บนเส้นทางวิ่ง พร้อม glow (shadowBlur) ให้ดูเรืองแสงเหมือนไฟฟ้าจริง
function drawLightningBranch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleDeg: number,
  length: number,
  depth: number,
  color: string
) {
  if (depth <= 0 || length < 5) return;
  const segments = 3 + Math.floor(Math.random() * 2);
  let cx = x;
  let cy = y;
  let angle = angleDeg;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (let i = 0; i < segments; i++) {
    angle += (Math.random() - 0.5) * 55;
    const segLen = length / segments;
    cx += Math.cos((angle * Math.PI) / 180) * segLen;
    cy += Math.sin((angle * Math.PI) / 180) * segLen;
    ctx.lineTo(cx, cy);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, depth * 1.4);
  ctx.stroke();
  if (Math.random() < 0.55) {
    drawLightningBranch(ctx, cx, cy, angle + (Math.random() < 0.5 ? 45 : -45), length * 0.55, depth - 1, color);
  }
}

/** วาดสายฟ้าเกาะตามเส้นทางทั้งเส้น — สุ่ม seed คงที่จาก path ให้รูปหน้าตาเดิมทุกครั้งที่ re-render (ไม่กระพริบตอนขยับ/ลาก)
 *  FIX: เพิ่มใหม่ตามที่ขอ — รับสีเป็น colors (LightningColors) แทน hardcode ฟ้า/ม่วง เลือกได้ทุกชั้นแล้ว */
function drawLightningAlongPath(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  colors: LightningColors
) {
  if (points.length < 2) return;
  // seeded PRNG ง่ายๆ จาก mulberry32 — ให้ผลลัพธ์เดิมทุกครั้ง (deterministic) ไม่สุ่มใหม่ทุก re-render
  let seed = Math.round(points[0]!.x * 1000 + points[0]!.y);
  const rand = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const origRandom = Math.random;
  // สลับ Math.random ชั่วคราวเป็นตัว seeded เฉพาะตอนวาดสายฟ้า (คืนค่าเดิมทันทีหลังวาดเสร็จ กันกระทบส่วนอื่น)
  Math.random = rand;
  try {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // ชั้น glow กว้างๆ เรืองแสงรอบเส้นทางทั้งเส้น (สีตามที่เลือก — outerGlow)
    ctx.shadowBlur = 24;
    ctx.shadowColor = colors.outerGlow;
    const branchColor = `rgba(${hexToRgb(colors.midGlow)},0.95)`;
    for (let i = 2; i < points.length - 2; i += 5) {
      const p = points[i]!;
      const prev = points[i - 2]!;
      const dirAngle = (Math.atan2(p.y - prev.y, p.x - prev.x) * 180) / Math.PI;
      const branchCount = 1 + Math.floor(rand() * 2);
      for (let b = 0; b < branchCount; b++) {
        const side = rand() < 0.5 ? -1 : 1;
        const branchAngle = dirAngle + side * (70 + rand() * 35);
        const len = 26 + rand() * 46;
        ctx.globalAlpha = 0.55 + rand() * 0.4;
        drawLightningBranch(ctx, p.x, p.y, branchAngle, len, 3, branchColor);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  } finally {
    Math.random = origRandom;
  }
}

export interface ElementTransform {
  x: number; // px offset บน canvas 1080x1920 (บวก = ขวา/ล่าง)
  y: number;
  scale: number; // 1 = ขนาดเดิม
}

export interface RunShareOptions {
  distanceKm: number;
  durationSeconds: number;
  path: RunSharePoint[];
  lineColor?: string; // hex เช่น "#e0201a" ค่า default แดงตามดีไซน์ต้นแบบ
  backgroundImage?: HTMLImageElement | null;
  date?: Date;
  // FIX: เพิ่มใหม่ตามที่ขอ — ให้ผู้ใช้ลาก/ขยับ/ขยายองค์ประกอบแต่ละชิ้น (การ์ดสถิติ, เส้นทาง, QR)
  // เองได้บนพรีวิวจริง แทนที่ตำแหน่ง/ขนาดจะตายตัวเหมือนเดิม ไม่ใส่มา = ใช้ตำแหน่งเดิมทุกอย่าง (ไม่กระทบของเก่า)
  // FIX: เพิ่มใหม่ตามที่ขอ — เปิด/ปิดเอฟเฟกต์สายฟ้าเกาะเส้นทาง (default true ตามที่ขอ)
  electric?: boolean;
  // FIX: เพิ่มใหม่ตามที่ขอ "เปลี่ยนสีเอฟเฟกวิ่งได้ทุกสี ทุกเฉด ทุกชั้น" — คุมสีทั้ง 8 ชั้นแยกกันได้
  // (ใช้ type เดียวกับกราฟสายฟ้าสรุปสัปดาห์ใน share-image.ts ให้ UI เลือกสีใช้ร่วมกันแบบเดียวกันได้)
  // ไม่ส่งมา = ไล่เฉดอัตโนมัติจาก lineColor เดียวเหมือนพฤติกรรมเดิม (ไม่กระทบของเก่า)
  lightningColors?: LightningColors;
  transform?: { card?: ElementTransform; route?: ElementTransform; qr?: ElementTransform };
}

// ขนาด canvas คงที่ (IG Story 9:16) — export ให้ UI ฝั่ง React คำนวณกรอบลาก/ขยับให้ตรงกับที่วาดจริงเป๊ะ
export const SHARE_CANVAS_WIDTH = 1080;
export const SHARE_CANVAS_HEIGHT = 1920;

// ตำแหน่ง/ขนาด "ฐาน" (ก่อนใส่ transform) ของแต่ละองค์ประกอบ บน canvas 1080x1920 — ให้ UI (ShareRunModal)
// ใช้วาดกรอบลาก/ขยับทับพรีวิวให้ตรงตำแหน่งจริงเป๊ะ โดยไม่ต้อง hardcode ตัวเลขซ้ำสองที่
export const SHARE_LAYOUT_BOXES = {
  card: { x: 64, y: 110, w: 1080 - 64 * 2, h: 340 },
  route: { x: 90, y: 110 + 340 + 90, w: 1080 - 90 * 2, h: 1000 },
  qr: { x: 1080 / 2 - 140, y: 1920 - 90 - 52 - (210 + 36) - 30, w: 280, h: (210 + 36) + 30 + 52 },
} as const;

const WIDTH = SHARE_CANVAS_WIDTH;
const HEIGHT = SHARE_CANVAS_HEIGHT;

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

// FIX: เพิ่มใหม่ — ปรับความสว่างของสี hex ที่ผู้ใช้เลือก (amt บวก = สว่างขึ้น, ลบ = เข้มขึ้น)
// ใช้ทำไฮไลต์บนเส้น + เงาใต้เส้นให้เข้าธีม 3D โดยอัตโนมัติจากสีเดียวที่เลือก ไม่ต้องเลือกสีเพิ่ม
function shadeColor(hex: string, amt: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// FIX: เพิ่มใหม่ตามที่ขอ "เปลี่ยนสีเอฟเฟกวิ่งได้ทุกสี ทุกเฉด ทุกชั้น" — ถ้าผู้ใช้ยังไม่ได้เลือกสีทีละชั้น
// เอง (ผ่าน opts.lightningColors) สร้างชุดสีทั้ง 8 ชั้นจาก lineColor เดียวให้อัตโนมัติ ยังดูกลมกลืน
// เป็นธีมเดียวกันเหมือนพฤติกรรมเดิม — ถ้าอยากคุมทีละชั้นเป๊ะๆ ส่ง lightningColors มาตรงๆ จะ override หมด
function deriveLightningColorsFromLine(lineColor: string): LightningColors {
  return {
    outerGlow: shadeColor(lineColor, 40),
    midGlow: shadeColor(lineColor, 70),
    shadow3d: shadeColor(lineColor, -90),
    coreStart: shadeColor(lineColor, 60),
    coreMid: lineColor,
    coreEnd: shadeColor(lineColor, -30),
    highlight: "#ffffff",
    sparkGlow: shadeColor(lineColor, 80),
  };
}

// FIX: เพิ่มใหม่ — แปลงพิกัด lat/lng เป็นตำแหน่ง pixel บน tile web mercator มาตรฐาน (เหมือน Leaflet/Google ใช้)
function lngLatToWorldPx(lng: number, lat: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** โหลด tile รูปเดียวจาก OSM (คืน null เงียบๆ ถ้าโหลดไม่สำเร็จ ไม่ throw ให้กระทบรูปหลัก) */
function loadTileImage(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
}

/**
 * FIX: เพิ่มใหม่ — ดึงแผนที่จริงย่อๆ ของบริเวณที่วิ่ง (ไม่ใช่แค่เส้นลอยๆ) มาต่อกันเป็นพื้นหลัง
 * ครอบพื้นที่ bounding box ของเส้นทาง GPS ที่วิ่งจริง แล้ว crop ให้พอดีกรอบที่ต้องการ
 * ทำงานแบบ best-effort: ถ้า tile โหลดไม่สำเร็จ (เน็ต/CORS) จะคืน null แล้วโค้ดที่เรียกใช้
 * fallback ไปใช้พื้นหลังเดิมแบบเงียบๆ ไม่ทำให้สร้างรูปทั้งใบพัง
 */
async function loadAreaMapBackground(
  path: RunSharePoint[],
  boxW: number,
  boxH: number
): Promise<HTMLCanvasElement | null> {
  try {
    if (path.length < 2) return null;
    const lats = path.map((p) => p.lat);
    const lngs = path.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // เลือก zoom ที่ทำให้ bounding box ของเส้นทางพอดีกับกรอบ (เผื่อขอบ 40%) แต่ไม่เกิน 18 (ละเอียดสุดของ OSM ทั่วไป)
    let zoom = 18;
    for (let z = 18; z >= 10; z--) {
      const p1 = lngLatToWorldPx(minLng, maxLat, z);
      const p2 = lngLatToWorldPx(maxLng, minLat, z);
      const spanW = Math.abs(p2.x - p1.x);
      const spanH = Math.abs(p2.y - p1.y);
      if (spanW <= boxW * 0.6 && spanH <= boxH * 0.6) { zoom = z; break; }
      zoom = z;
    }

    const center = lngLatToWorldPx(centerLng, centerLat, zoom);
    const originX = center.x - boxW / 2;
    const originY = center.y - boxH / 2;

    const tileSize = 256;
    const firstTileX = Math.floor(originX / tileSize);
    const firstTileY = Math.floor(originY / tileSize);
    const lastTileX = Math.floor((originX + boxW) / tileSize);
    const lastTileY = Math.floor((originY + boxH) / tileSize);
    const maxTileIndex = 2 ** zoom - 1;

    const canvas = document.createElement("canvas");
    canvas.width = boxW;
    canvas.height = boxH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const loads: Promise<void>[] = [];
    let anyLoaded = false;
    for (let tx = firstTileX; tx <= lastTileX; tx++) {
      for (let ty = firstTileY; ty <= lastTileY; ty++) {
        if (tx < 0 || ty < 0 || tx > maxTileIndex || ty > maxTileIndex) continue;
        loads.push(
          loadTileImage(zoom, tx, ty).then((img) => {
            if (!img) return;
            anyLoaded = true;
            ctx.drawImage(img, tx * tileSize - originX, ty * tileSize - originY, tileSize, tileSize);
          })
        );
      }
    }
    await Promise.all(loads);
    if (!anyLoaded) return null;

    // ทำให้ tile เป็นโทนขาวดำคอนทราสต์สูงแบบ noir ให้เข้ากับธีมแอป + ให้เส้นทางสีสันตัดกันชัดด้านบน
    ctx.globalCompositeOperation = "saturation";
    ctx.fillStyle = "hsl(0,0%,50%)";
    ctx.fillRect(0, 0, boxW, boxH);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(15,15,18,0.55)";
    ctx.fillRect(0, 0, boxW, boxH);

    return canvas;
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
  const cardX = SHARE_LAYOUT_BOXES.card.x;
  const cardY = SHARE_LAYOUT_BOXES.card.y;
  const cardW = SHARE_LAYOUT_BOXES.card.w;
  const cardH = SHARE_LAYOUT_BOXES.card.h;
  const cardT = opts.transform?.card ?? { x: 0, y: 0, scale: 1 };
  ctx.save();
  ctx.translate(cardX + cardW / 2 + cardT.x, cardY + cardH / 2 + cardT.y);
  ctx.scale(cardT.scale, cardT.scale);
  ctx.translate(-(cardX + cardW / 2), -(cardY + cardH / 2));
  ctx.fillStyle = "rgba(18,18,20,0.95)";
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "500 30px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("WEEKER RUN", cardX + 44, cardY + 74);
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
  ctx.restore(); // ปิด transform การ์ด

  // เส้นทางจริงจาก GPS — โปรเจกต์ equirectangular ง่ายๆ (x = lng*cos(lat), y = lat) แล้วสเกลให้พอดี
  const pathAreaX = SHARE_LAYOUT_BOXES.route.x;
  const pathAreaY = SHARE_LAYOUT_BOXES.route.y;
  const pathAreaW = SHARE_LAYOUT_BOXES.route.w;
  const pathAreaH = SHARE_LAYOUT_BOXES.route.h;
  const lineColor = opts.lineColor || "#e0201a";
  const routeT = opts.transform?.route ?? { x: 0, y: 0, scale: 1 };
  ctx.save();
  ctx.translate(pathAreaX + pathAreaW / 2 + routeT.x, pathAreaY + pathAreaH / 2 + routeT.y);
  ctx.scale(routeT.scale, routeT.scale);
  ctx.translate(-(pathAreaX + pathAreaW / 2), -(pathAreaY + pathAreaH / 2));

  // FIX: เพิ่มใหม่ — พยายามดึงแผนที่จริงย่อๆ ของบริเวณที่วิ่งมาแปะเป็นพื้นหลังของกรอบเส้นทาง
  // (ถ้าผู้ใช้ไม่ได้อัปโหลดรูปพื้นหลังเองไว้ก่อนแล้ว) โหลดไม่สำเร็จก็ไม่เป็นไร ใช้พื้นเดิมต่อ
  if (!opts.backgroundImage && opts.path.length >= 2) {
    const areaMap = await loadAreaMapBackground(opts.path, pathAreaW, pathAreaH);
    if (areaMap) {
      roundRect(ctx, pathAreaX, pathAreaY, pathAreaW, pathAreaH, 28);
      ctx.save();
      ctx.clip();
      ctx.drawImage(areaMap, pathAreaX, pathAreaY);
      ctx.restore();
    }
  }

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

    // FIX: เปลี่ยนจาก auto-shade จาก lineColor เดี่ยว เป็นใช้สีทั้ง 8 ชั้นจาก colors ตามที่ขอ
    // "เปลี่ยนสีได้ทุกสี ทุกเฉด ทุกชั้น" — ไม่ได้เลือกทีละชั้นมาก็ derive อัตโนมัติจาก lineColor เหมือนเดิม
    const colors: LightningColors = opts.lightningColors ?? deriveLightningColorsFromLine(lineColor);
    const lift = 22; // ความสูงที่ยกขึ้น (px) ยิ่งมากยิ่งดูนูน/3D ชัด
    const baseColor = colors.shadow3d;
    const midColor = colors.coreEnd;
    const highlightColor = colors.coreStart;

    const strokePath = (yOffset: number) => {
      ctx.beginPath();
      opts.path.forEach((_, i) => {
        const { x, y } = toScreen(i);
        if (i === 0) ctx.moveTo(x, y + yOffset);
        else ctx.lineTo(x, y + yOffset);
      });
      ctx.stroke();
    };

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // ชั้นเงาตกกระทบบนพื้นแผนที่ (เบลอเข้ม บอกตำแหน่งที่เส้นลอยอยู่เหนือพื้น)
    ctx.save();
    ctx.filter = "blur(10px)";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 20;
    strokePath(lift + 6);
    ctx.restore();

    // ชั้นฐาน/ผนังเส้น (extrusion) ไล่จากเข้มไปกลาง สร้างมิติความหนา
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 20;
    strokePath(lift);
    ctx.strokeStyle = midColor;
    ctx.lineWidth = 20;
    strokePath(lift * 0.6);

    // เส้นบนสุด — ไล่เฉดจากสีจริงเป็นไฮไลต์สว่าง จำลองแสงตกกระทบด้านบนของเส้นทาง
    const grad = ctx.createLinearGradient(0, pathAreaY, 0, pathAreaY + pathAreaH);
    grad.addColorStop(0, highlightColor);
    grad.addColorStop(0.5, colors.coreMid);
    grad.addColorStop(1, midColor);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 18;
    strokePath(0);

    // เส้นไฮไลต์บางๆ เพิ่มความเงาให้ดูนูนเหมือนมีแสงสะท้อน (สี highlight ที่เลือกได้)
    ctx.strokeStyle = `rgba(${hexToRgb(colors.highlight)},0.6)`;
    ctx.lineWidth = 5;
    strokePath(-4);

    // FIX: เพิ่มใหม่ตามที่ขอ — สายฟ้าเกาะเส้นทาง (default เปิด ปิดได้ผ่าน opts.electric = false)
    // สีทุกชั้นของสายฟ้าตอนนี้เลือกเองได้ผ่าน colors เช่นกัน (outerGlow/midGlow)
    if (opts.electric !== false) {
      const screenPoints = opts.path.map((_, i) => {
        const s = toScreen(i);
        return { x: s.x, y: s.y - lift };
      });
      drawLightningAlongPath(ctx, screenPoints, colors);
    }

    // จุดเริ่มต้น (blob กลมใหญ่ ตามดีไซน์ต้นแบบ) — ทำเป็นทรงกลม 3D ด้วย radial gradient
    const start = toScreen(0);
    const blobGrad = ctx.createRadialGradient(
      start.x - 8, start.y - lift - 8, 4,
      start.x, start.y - lift, 30
    );
    blobGrad.addColorStop(0, highlightColor);
    blobGrad.addColorStop(1, baseColor);
    ctx.beginPath();
    ctx.ellipse(start.x, start.y + 4, 22, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(start.x, start.y - lift, 26, 0, Math.PI * 2);
    ctx.fillStyle = blobGrad;
    ctx.fill();
  }
  ctx.restore(); // ปิด transform เส้นทาง

  // FIX: ฝัง URL ไปพร้อมรูปตามที่ขอ — badge ชื่อเว็บ + QR สแกนเปิดเว็บ (แบบเดียวกับรูปสรุปสัปดาห์)
  const siteUrl = typeof window !== "undefined" ? window.location.host : "weeker.onrender.com";
  const isDarkBg = !!opts.backgroundImage; // มีรูปพื้นหลังเอง เดาว่าอาจเข้มกว่าเดิม ใช้ badge โปร่งเข้มเสมอ ให้อ่านง่ายไม่ว่าพื้นหลังจะเป็นสีอะไร
  const qrT = opts.transform?.qr ?? { x: 0, y: 0, scale: 1 };
  const qrBoxCenterX = SHARE_LAYOUT_BOXES.qr.x + SHARE_LAYOUT_BOXES.qr.w / 2;
  const qrBoxCenterY = SHARE_LAYOUT_BOXES.qr.y + SHARE_LAYOUT_BOXES.qr.h / 2;
  ctx.save();
  ctx.translate(qrBoxCenterX + qrT.x, qrBoxCenterY + qrT.y);
  ctx.scale(qrT.scale, qrT.scale);
  ctx.translate(-qrBoxCenterX, -qrBoxCenterY);
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
  ctx.restore(); // ปิด transform QR/badge

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
