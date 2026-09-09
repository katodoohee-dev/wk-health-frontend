import {
  apiAssistantChat,
  apiAssistantHistory,
  apiDiary,
  apiGallery,
  apiMe,
  apiMusicHistory,
  apiMusicLibrary,
  apiPedometerToday,
  apiRouteHistory,
  apiStatsToday,
  apiStatsWeekly,
  apiWorkoutHistory,
  todayISO,
  type ChatMessage,
} from "@/lib/api";

export async function collectWebsiteAIContext() {
  const results = await Promise.allSettled([
    apiMe(),
    apiDiary(todayISO()),
    apiStatsToday(),
    apiStatsWeekly(),
    apiPedometerToday(),
    apiWorkoutHistory(),
    apiRouteHistory(),
    apiMusicLibrary(),
    apiMusicHistory(),
    apiAssistantHistory(),
    apiGallery(),
  ]);
  const value = <T,>(i: number, fallback: T): T => {
    const r = results[i];
    return r && r.status === "fulfilled" ? (r.value as T) : fallback;
  };
  return {
    user: value(0, null),
    diaryToday: value(1, []),
    statsToday: value(2, null),
    statsWeekly: value(3, []),
    pedometerToday: value(4, null),
    workoutHistory: value(5, []),
    routeHistory: value(6, []),
    musicLibrary: value(7, []),
    musicHistory: value(8, []),
    assistantHistory: value(9, []),
    gallery: value(10, []),
  };
}

export function compactWebsiteAIContext(context: Awaited<ReturnType<typeof collectWebsiteAIContext>>) {
  const json = JSON.stringify(context);
  return json.length > 18000 ? `${json.slice(0, 18000)}\n[ข้อมูลถูกตัดส่วนท้ายเพื่อความปลอดภัยของ request]` : json;
}

/**
 * ห่อ "ข้อความ" ของผู้ใช้ด้วยบริบทข้อมูลจริงจากทั้งเว็บ (ไดอารีวันนี้, สถิติ, ก้าวเดิน,
 * ประวัติออกกำลังกาย/เส้นทาง, คลังเพลง, ประวัติการฟัง, ประวัติแชทเดิม, แกลเลอรี) ก่อนส่งให้ AI
 * เพื่อให้ผู้ช่วยตอบแบบรู้จักผู้ใช้และรู้จักทั้งแอปจริงๆ ไม่ใช่แค่ข้อความโดดๆ
 * ไม่เปลี่ยนรูปแบบ request ที่ backend รับ (ยังเป็น string เดียวใน field "message" เหมือนเดิม
 * — ไม่เพิ่ม field ใหม่ กัน zod schema เดิม reject) แค่ทำให้เนื้อหาใน message สมบูรณ์ขึ้น
 * ถ้าดึงบริบทไม่สำเร็จ (เช่น เน็ตหลุด) fallback กลับไปส่งข้อความเดิมตรงๆ ไม่ให้แชทพัง
 */
export async function buildContextualMessage(userMessage: string): Promise<string> {
  try {
    const context = await collectWebsiteAIContext();
    const compact = compactWebsiteAIContext(context);
    return [
      "[บริบทข้อมูลจริงของผู้ใช้คนนี้จากทั้งแอป ณ ตอนนี้ — ใช้ประกอบการตอบให้แม่นยำและเป็นส่วนตัว",
      " ไม่ต้องอ้างถึงหรือพูดถึงข้อมูล JSON นี้ตรงๆ กับผู้ใช้]",
      compact,
      "",
      "[ข้อความจากผู้ใช้]",
      userMessage,
    ].join("\n");
  } catch {
    return userMessage;
  }
}

/** ส่งข้อความไปหาผู้ช่วย AI พร้อมบริบททั้งเว็บแนบไปด้วยเสมอ ใช้แทน apiAssistantChat ตรงๆ ได้ทุกจุด */
export async function apiAssistantChatWithContext(userMessage: string): Promise<ChatMessage> {
  const augmented = await buildContextualMessage(userMessage);
  return apiAssistantChat(augmented);
}
