// สร้างรูปสรุปสัปดาห์แบบ client-side ล้วนๆ ด้วย Canvas API
// ไม่ต้องพึ่ง backend หรือ library ภายนอก — ทำงานได้แม้ backend export ยังไม่มี

export interface WeekShareData {
  streak: number;
  avgKcal: number;
  daysOnGoal: number;
  userName?: string;
}

const WIDTH = 1080;
const HEIGHT = 1350; // อัตราส่วนโพสต์ IG story-friendly

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
  const cardH = HEIGHT - cardY - 160;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, pad, cardY, WIDTH - pad * 2, cardH, 48);
  ctx.fill();

  // heading
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.font = "600 40px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(data.userName ? `สรุปสัปดาห์ของ ${data.userName}` : "สรุปสัปดาห์ของฉัน", WIDTH / 2, 130);

  ctx.font = "400 26px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "rgba(15,23,42,0.55)";
  ctx.fillText("WK Health App", WIDTH / 2, 175);

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

  if (typeof navigator !== "undefined" && "canShare" in navigator && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "สรุปสัปดาห์ของฉัน" });
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
