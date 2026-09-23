// สร้างรูปสรุปสัปดาห์แบบ client-side ล้วนๆ ด้วย Canvas API
// ไม่ต้องพึ่ง backend หรือ library ภายนอก — ทำงานได้แม้ backend export ยังไม่มี

export interface WeekShareData {
  streak: number;
  avgKcal: number;
  daysOnGoal: number;
  userName?: string;
  // FIX: เพิ่มใหม่ — ตามที่คุยกันเรื่องดีไซน์ "สายฟ้า 5 เส้น" สำหรับเส้นสถิติก้าวเดิน
  // ส่งมาเป็นตัวเลขก้าวเดิน 7 วันล่าสุด เรียงจากเก่าไปใหม่ (index 0 = 6 วันก่อน ... index 6 = วันนี้)
  // ถ้าไม่ส่งมา จะข้ามส่วนกราฟสายฟ้าไปเงียบๆ (รูปยังสร้างได้ปกติ แค่ไม่มีกราฟ)
  weeklySteps?: number[];
}

const WIDTH = 1080;

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

/**
 * วาดกราฟ "สายฟ้า" 5 ชั้นตามที่คุยดีไซน์กันไว้ (สรุปสุดท้าย: 5 เส้นซ้อนกัน คมชัดทุกดีเทล คุมโทนไม่ลายตา):
 *   1. Outer glow — ม่วง/น้ำเงินเข้ม เบลอกว้างสุด โปร่งใสมาก ให้บรรยากาศแสงสะท้อนรอบตัว
 *   2. Mid glow — ฟ้าสด เบลอปานกลาง ให้ความรู้สึกเรืองแสงจริง
 *   3. เส้นเงา 3D (drop layer) — น้ำเงินกรมท่า เยื้องลงขวาเล็กน้อย ให้มิติ เหมือนเส้นลอยเหนือพื้น
 *   4. เส้นหลัก (core line) — ไล่สี gradient ม่วง→ฟ้า→ขาว เป็นเส้นที่ "อ่านค่าได้จริง"
 *   5. Highlight — ขาวสว่างบางวิ่งกลางเส้นหลัก ให้ความรู้สึกโลหะ/แก้วมันวาว
 * เส้นเชื่อมจุดแบบหักมุมตรงๆ (ไม่ smooth โค้ง) ให้ได้ฟีล "ซิกแซกแบบฟ้าผ่า" ตามข้อมูลจริงของแต่ละวัน
 * บวกจุดประกายดาว (spark burst) ที่แต่ละจุดข้อมูล และพื้นหลัง dark navy + grid บางๆ แบบ cyberpunk
 */
function drawLightningTrend(
  ctx: CanvasRenderingContext2D,
  values: number[],
  panelX: number,
  panelY: number,
  panelW: number,
  panelH: number
) {
  // พื้นหลัง dark navy โค้งมน
  const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  bgGrad.addColorStop(0, "#0c0a1f");
  bgGrad.addColorStop(1, "#050414");
  ctx.fillStyle = bgGrad;
  roundRect(ctx, panelX, panelY, panelW, panelH, 36);
  ctx.fill();

  // หัวข้อพาเนล
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "600 30px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("ก้าวเดิน 7 วันล่าสุด ⚡", panelX + 40, panelY + 62);

  const chartX = panelX + 56;
  const chartY = panelY + 110;
  const chartW = panelW - 112;
  const chartH = panelH - 210;

  // grid บางๆ แบบ cyberpunk (เส้นแนวนอน 3 เส้น)
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= 3; i++) {
    const gy = chartY + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(chartX, gy);
    ctx.lineTo(chartX + chartW, gy);
    ctx.stroke();
  }

  if (values.length < 2) return;

  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const span = maxV - minV || 1;
  const stepX = chartW / (values.length - 1);
  const points = values.map((v, i) => ({
    x: chartX + stepX * i,
    y: chartY + chartH - ((v - minV) / span) * chartH * 0.86 - chartH * 0.06, // เผื่อขอบบน-ล่าง 6%
  }));

  const strokePath = () => {
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y); // หักมุมตรงๆ ไม่ smooth ให้ได้ฟีลซิกแซกแบบฟ้าผ่าตามข้อมูลจริง
    });
    ctx.stroke();
  };

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // ชั้น 1: Outer glow (ม่วง/น้ำเงินเข้ม เบลอกว้างสุด)
  ctx.save();
  ctx.strokeStyle = "rgba(139,92,246,0.35)";
  ctx.lineWidth = 24;
  ctx.shadowColor = "#8b5cf6";
  ctx.shadowBlur = 40;
  strokePath();
  ctx.restore();

  // ชั้น 2: Mid glow (ฟ้าสด เบลอปานกลาง)
  ctx.save();
  ctx.strokeStyle = "rgba(56,189,248,0.55)";
  ctx.lineWidth = 14;
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 20;
  strokePath();
  ctx.restore();

  // ชั้น 3: เส้นเงา 3D (น้ำเงินกรมท่า เยื้องลงขวา 5px ให้มีมิติ)
  ctx.save();
  ctx.translate(5, 6);
  ctx.strokeStyle = "rgba(15,23,90,0.65)";
  ctx.lineWidth = 10;
  strokePath();
  ctx.restore();

  // ชั้น 4: เส้นหลัก ไล่สี ม่วง→ฟ้า→ขาว
  const coreGrad = ctx.createLinearGradient(chartX, 0, chartX + chartW, 0);
  coreGrad.addColorStop(0, "#a78bfa");
  coreGrad.addColorStop(0.5, "#38bdf8");
  coreGrad.addColorStop(1, "#f0f9ff");
  ctx.strokeStyle = coreGrad;
  ctx.lineWidth = 7;
  strokePath();

  // ชั้น 5: Highlight ขาวสว่างบางกลางเส้น
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2.5;
  strokePath();

  // จุดข้อมูล = ประกายดาว (spark burst) เล็กๆ ที่แต่ละจุด
  points.forEach((p) => {
    ctx.save();
    ctx.shadowColor = "#e0f2fe";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ffffff";
    const r = 6;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      const outerX = p.x + Math.cos(a) * r * 2.2;
      const outerY = p.y + Math.sin(a) * r * 2.2;
      const innerA = a + Math.PI / 4;
      const innerX = p.x + Math.cos(innerA) * r * 0.6;
      const innerY = p.y + Math.sin(innerA) * r * 0.6;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // label วันในสัปดาห์ (7 วันล่าสุด นับถอยไปจากวันนี้)
  const dayLabels = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
  const today = new Date().getDay(); // 0=อา
  const thaiIdx = (today + 6) % 7; // แปลงให้ 0=จ
  ctx.font = "500 22px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = "center";
  points.forEach((p, i) => {
    const back = values.length - 1 - i;
    const idx = (((thaiIdx - back) % 7) + 7) % 7;
    ctx.fillText(dayLabels[idx]!, p.x, panelY + panelH - 30);
  });
}

/** วาดการ์ดสรุปสัปดาห์ลง canvas แล้วคืนค่าเป็น Blob (image/png) */
export async function renderWeekShareImage(data: WeekShareData): Promise<Blob> {
  const includeChart = !!(data.weeklySteps && data.weeklySteps.length >= 2);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;

  const pad = 64;
  const cardY = 220;
  const cardH = 970;
  const chartPanelH = includeChart ? 460 : 0;
  const chartPanelGap = includeChart ? 50 : 0;
  const qrSize = 200;
  const qrBoxSize = qrSize + 40;
  const HEIGHT = cardY + cardH + chartPanelGap + chartPanelH + 60 + qrBoxSize + 42 + 120;
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
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, pad, cardY, WIDTH - pad * 2, cardH, 48);
  ctx.fill();

  // FIX: เพิ่มใหม่ — ตามที่ขอ "ลิงก์/ชื่อเว็บโผล่มุมซ้ายบน" ของรูปที่แชร์ลงสตอรี่ (ไม่ใช่ลิงก์กดได้จริง —
  // Instagram/Facebook/TikTok ล็อกฟีเจอร์ลิงก์กดได้จากภายนอกไว้ ต้องเป็นแอปที่จดทะเบียนกับ Meta/TikTok
  // เท่านั้น เว็บทำเองไม่ได้ นี่คือทางที่ทำได้จริง: เผาชื่อเว็บลงในรูปให้คนเห็นแล้วจำ/พิมพ์ตามเอง)
  const siteUrl = typeof window !== "undefined" ? window.location.host : "weeker.onrender.com";
  const badgePadX = 22;
  const badgeH = 52;
  ctx.font = "600 26px 'Segoe UI', system-ui, sans-serif";
  const badgeTextW = ctx.measureText(siteUrl).width;
  const badgeW = badgeTextW + badgePadX * 2 + 34;
  ctx.fillStyle = "rgba(15,23,42,0.32)";
  roundRect(ctx, 48, 44, badgeW, badgeH, badgeH / 2);
  ctx.fill();
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

  // FIX: เพิ่มใหม่ — กราฟสายฟ้า 5 ชั้น ตามที่คุยดีไซน์กันไว้ (แค่ตอนมีข้อมูล weeklySteps ส่งมา)
  let afterY = cardY + cardH;
  if (includeChart) {
    const panelY = afterY + chartPanelGap;
    drawLightningTrend(ctx, data.weeklySteps!, pad, panelY, WIDTH - pad * 2, chartPanelH);
    afterY = panelY + chartPanelH;
  }

  // QR code สแกนเปิดเว็บได้ทันที
  const qrImg = await loadQrImage(`https://${siteUrl}`, qrSize * 2);
  if (qrImg) {
    const qrBoxPad = 20;
    const qrX = WIDTH / 2 - qrBoxSize / 2;
    const qrY = afterY + 60;
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
  const shareUrl = typeof window !== "undefined" ? window.location.origin : undefined;
  const shareData = { files: [file], title: "สรุปสัปดาห์ของฉัน — Weeker", text: "สรุปสัปดาห์ของฉันจาก Weeker", url: shareUrl };

  if (typeof navigator !== "undefined" && "canShare" in navigator && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share(shareData);
      return "shared" as const;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled" as const;
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
