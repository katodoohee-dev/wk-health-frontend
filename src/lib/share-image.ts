// สร้างรูปสรุปสัปดาห์แบบ client-side ล้วนๆ ด้วย Canvas API
// ไม่ต้องพึ่ง backend หรือ library ภายนอก — ทำงานได้แม้ backend export ยังไม่มี

export interface WeekShareData {
  streak: number;
  avgKcal: number;
  daysOnGoal: number;
  userName?: string;
}

const WIDTH = 1080;
const HEIGHT = 1650; // FIX: เพิ่มความสูงจากเดิม 1350 เพื่อเผื่อที่ให้ QR code ด้านล่างการ์ด ไม่ให้ทับสถิติ

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// FIX: เพิ่มใหม่ — ตามที่ขอ "ฝัง URL ไปพร้อมรูป" จริงๆ ให้ดีกว่าแค่เผาตัวหนังสือ ใช้ QR code แทน เพราะ
// สแกนด้วยกล้องมือถือได้ทันทีไม่ว่าจะแชร์ไปแพลตฟอร์มไหน (IG/FB/TikTok/Line ฯลฯ) ไม่ติดข้อจำกัดเรื่อง
// ลิงก์คลิกได้เลย เพราะมันเป็นแค่รูปภาพส่วนหนึ่งของรูปที่แชร์ ไม่ต้องพึ่ง API ของแพลตฟอร์มใดๆ
// ใช้ api.qrserver.com (ฟรี รองรับ CORS ไม่ต้องลง library เพิ่ม) ถ้าโหลดไม่สำเร็จ (เช่นไม่มีเน็ตตอนสร้างรูป)
// ก็ข้ามไปเงียบๆ ยังเหลือ badge ชื่อเว็บมุมซ้ายบนช่วยไว้อยู่ดี ไม่ทำให้สร้างรูปพัง
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

/** วาดการ์ดสรุปสัปดาห์ลง canvas แล้วคืนค่าเป็น Blob (image/png) */
export async function renderWeekShareImage(data: WeekShareData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas ไม่รองรับในเบราว์เซอร์นี้");

  // background gradient (mint -> sky)
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#8fe3c4");
  bg.addColorStop(1, "#8fc9e8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // white glass card
  const pad = 64;
  const cardY = 220;
  const cardH = 970; // FIX: คงที่ไว้เท่าค่าที่เคยคำนวณได้ตอน HEIGHT=1350 เดิม (ไม่ผูกกับ HEIGHT ใหม่ที่สูงขึ้น
  // เพราะสูงขึ้นมาเพื่อเผื่อที่ให้ QR โค้ดด้านล่างเท่านั้น ไม่ได้ต้องการให้การ์ดสถิติสูงตามไปด้วย)
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, pad, cardY, WIDTH - pad * 2, cardH, 48);
  ctx.fill();

  // FIX: เพิ่มใหม่ — ตามที่ขอ "ลิงก์/ชื่อเว็บโผล่มุมซ้ายบน" ของรูปที่แชร์ลงสตอรี่ (ไม่ใช่ลิงก์กดได้จริง —
  // Instagram/Facebook/TikTok ล็อกฟีเจอร์ลิงก์กดได้จากภายนอกไว้ ต้องเป็นแอปที่จดทะเบียนกับ Meta/TikTok
  // เท่านั้น เว็บทำเองไม่ได้ นี่คือทางที่ทำได้จริง: เผาชื่อเว็บลงในรูปให้คนเห็นแล้วจำ/พิมพ์ตามเอง)
  const siteUrl = typeof window !== "undefined" ? window.location.host : "wk-health-frontend.onrender.com";
  const badgePadX = 22;
  const badgeH = 52;
  ctx.font = "600 26px 'Segoe UI', system-ui, sans-serif";
  const badgeTextW = ctx.measureText(siteUrl).width;
  const badgeW = badgeTextW + badgePadX * 2 + 34;
  ctx.fillStyle = "rgba(15,23,42,0.32)";
  roundRect(ctx, 48, 44, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  // จุดเล็กๆ นำหน้าแบบไอคอนแบรนด์ (มินต์ตัดกับพื้นหลัง badge)
  ctx.beginPath();
  ctx.arc(48 + badgePadX + 10, 44 + badgeH / 2, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#8fe3c4";
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(siteUrl, 48 + badgePadX + 30, 44 + badgeH / 2 + 9);

  // heading
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.font = "600 40px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(data.userName ? `สรุปสัปดาห์ของ ${data.userName}` : "สรุปสัปดาห์ของฉัน", WIDTH / 2, 130);

  ctx.font = "400 26px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "rgba(15,23,42,0.55)";
  ctx.fillText("Weeker", WIDTH / 2, 175);

  // stats
  const stats: { label: string; value: string }[] = [
    { label: "วัน streak", value: String(data.streak) },
    { label: "kcal เฉลี่ย/วัน", value: String(data.avgKcal) },
    { label: "วันตามเป้า", value: `${data.daysOnGoal}/7` },
  ];

  const rowH = cardH / stats.length;
  stats.forEach((s, i) => {
    const y = cardY + rowH * i + rowH / 2;
    ctx.textAlign = "left";
    ctx.font = "500 32px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#334155";
    ctx.fillText(s.label, pad + 56, y + 12);

    ctx.textAlign = "right";
    ctx.font = "700 64px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(s.value, WIDTH - pad - 56, y + 20);

    if (i < stats.length - 1) {
      ctx.strokeStyle = "rgba(15,23,42,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad + 40, cardY + rowH * (i + 1));
      ctx.lineTo(WIDTH - pad - 40, cardY + rowH * (i + 1));
      ctx.stroke();
    }
  });

  // FIX: เพิ่มใหม่ — QR code สแกนเปิดเว็บได้ทันที วางไว้เหนือวันที่ด้านล่าง มีกล่องขาวรองพื้นให้สแกนง่าย
  const qrSize = 200;
  const qrImg = await loadQrImage(`https://${siteUrl}`, qrSize * 2); // โหลดละเอียดกว่าขนาดจริง 2 เท่า กันภาพแตก
  if (qrImg) {
    const qrBoxPad = 20;
    const qrBoxSize = qrSize + qrBoxPad * 2;
    const qrX = WIDTH / 2 - qrBoxSize / 2;
    const qrY = cardY + cardH + 60; // ใต้การ์ดสถิติแบบมีระยะห่างชัดเจน ไม่ทับกัน
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 24);
    ctx.fill();
    ctx.drawImage(qrImg, qrX + qrBoxPad, qrY + qrBoxPad, qrSize, qrSize);
    ctx.textAlign = "center";
    ctx.font = "500 24px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("แสกนเปิดเว็บ Weeker", WIDTH / 2, qrY + qrBoxSize + 42);
  }

  // footer
  ctx.textAlign = "center";
  ctx.font = "400 24px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }), WIDTH / 2, HEIGHT - 60);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("สร้างรูปไม่สำเร็จ"));
    }, "image/png");
  });
}

/** ดาวน์โหลดรูป หรือเปิด native share sheet ถ้าเบราว์เซอร์รองรับ (Web Share API level 2) */
export async function shareOrDownloadImage(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  // FIX: เพิ่มใหม่ — แนบ url ไปด้วยตอน share ไม่ใช่แค่รูปเฉยๆ แอปที่รองรับ (Line, Messenger, SMS,
  // Twitter/X ฯลฯ) จะขึ้นเป็นลิงก์กดเข้าเว็บได้จริงในโพสต์/ข้อความที่ส่ง — Instagram/Facebook Stories
  // และ TikTok ไม่รองรับส่วนนี้ (ดูเหตุผลในคอมเมนต์ที่ render ด้านบน) แต่แอปอื่นๆ ส่วนใหญ่รองรับ
  const shareUrl = typeof window !== "undefined" ? window.location.origin : undefined;
  const shareData = { files: [file], title: "สรุปสัปดาห์ของฉัน — Weeker", text: "สรุปสัปดาห์ของฉันจาก Weeker", url: shareUrl };

  if (typeof navigator !== "undefined" && "canShare" in navigator && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share(shareData);
      return "shared" as const;
    } catch (err) {
      // ผู้ใช้กดยกเลิก share sheet — ไม่ถือเป็น error
      if (err instanceof Error && err.name === "AbortError") return "cancelled" as const;
      // ตกไป fallback ดาวน์โหลดแทน
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded" as const;
}
