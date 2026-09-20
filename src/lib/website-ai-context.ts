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
import {
  apiFriendsList,
  apiFriendLocationSharingStatus,
  apiFriendLocations,
  apiFriendMessages,
} from "@/lib/api-new-features";

// FIX: เพิ่มใหม่ — ก่อนหน้านี้ผู้ช่วย AI เห็นแค่ไดอารี/สถิติ/เพลง/แกลเลอรี ไม่เห็นข้อมูลฝั่งเพื่อน/GPS/แชท
// เพื่อนเลย ทำให้ถามอะไรเกี่ยวกับเพื่อน ตำแหน่ง หรือแชทที่คุยกับเพื่อนไม่ได้ ("ไม่ต้องปิดกั้นความสามารถ")
// ตอนนี้ดึงมาให้ครบ: รายชื่อเพื่อน+streak, สถานะเปิด/ปิดแชร์ตำแหน่งของตัวเอง, ตำแหน่งเพื่อนที่แชร์อยู่,
// และแชทล่าสุดกับเพื่อนแต่ละคน (จำกัด 8 คนแรก + 10 ข้อความล่าสุด/คน กันก้อน context ใหญ่เกินไป)
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
    apiFriendsList(),
    apiFriendLocationSharingStatus(),
    apiFriendLocations(),
  ]);
  const value = <T,>(i: number, fallback: T): T => {
    const r = results[i];
    return r && r.status === "fulfilled" ? (r.value as T) : fallback;
  };
  const friends = value(11, [] as { id: string; name: string; streak: number; avatar?: string }[]);

  // แชทกับเพื่อน: ต้องรู้รายชื่อเพื่อนก่อน ถึงจะไปดึงแชทของแต่ละคนได้ (เลยแยกเป็นรอบสอง)
  const chatResults = await Promise.allSettled(
    friends.slice(0, 8).map((f) =>
      apiFriendMessages(f.id).then((r) => ({
        friendId: f.id,
        friendName: f.name,
        recentMessages: (r.messages ?? []).slice(-10),
      }))
    )
  );
  const friendChats = chatResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

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
    friends,
    friendLocationSharing: value(12, null),
    friendLocations: value(13, []),
    friendChats,
  };
}

export function compactWebsiteAIContext(context: Awaited<ReturnType<typeof collectWebsiteAIContext>>) {
  const json = JSON.stringify(context);
  return json.length > 26000 ? `${json.slice(0, 26000)}\n[ข้อมูลถูกตัดส่วนท้ายเพื่อความปลอดภัยของ request]` : json;
}

/**
 * รวบรวมบริบทข้อมูลจริงจากทั้งเว็บ (ไดอารีวันนี้, สถิติ, ก้าวเดิน, ประวัติออกกำลังกาย/เส้นทาง,
 * คลังเพลง, ประวัติการฟัง, ประวัติแชทเดิม, แกลเลอรี) แยกออกจากข้อความของผู้ใช้โดยเด็ดขาด
 * เพื่อให้ผู้ช่วยตอบแบบรู้จักผู้ใช้และรู้จักทั้งแอปจริงๆ โดยไม่ใช่แค่ข้อความโดดๆ
 *
 * FIX: บั๊กใหญ่ 🔴 — เดิมฟังก์ชันนี้ต่อ context (JSON) รวมเข้ากับ userMessage เป็น string เดียว
 * เพราะตอนนั้น backend schema รับแค่ field "message" อย่างเดียว ผลคือ JSON ก้อนใหญ่ + คำสั่งลับ
 * ("ห้ามพูดถึงข้อมูล JSON นี้ตรงๆ กับผู้ใช้") ถูกส่งไปเป็นส่วนหนึ่งของ "ข้อความผู้ใช้" แล้วถูก
 * backend บันทึกลงประวัติแชทแบบตรงๆ พอโหลดกลับมาแสดงผล เลยเห็น JSON หลุดในบับเบิลแชทของผู้ใช้เอง
 * ตอนนี้ backend รองรับ field "context" แยกต่างหากแล้ว จึงคืนค่าเป็น object {message, context}
 * แทน — message เป็นคำพูดจริงของผู้ใช้ล้วนๆ (จะถูกบันทึก/แสดงผล) ส่วน context ใช้แค่ประกอบ prompt
 * ฝั่ง backend เท่านั้น ไม่มีวันถูกบันทึกหรือแสดงเป็นข้อความของผู้ใช้อีกต่อไป
 */
export async function buildContextualMessage(
  userMessage: string
): Promise<{ message: string; context?: string }> {
  try {
    const context = await collectWebsiteAIContext();
    const compact = compactWebsiteAIContext(context);
    return { message: userMessage, context: compact };
  } catch {
    return { message: userMessage };
  }
}

/** ส่งข้อความไปหาผู้ช่วย AI พร้อมบริบททั้งเว็บแนบไปด้วยเสมอ ใช้แทน apiAssistantChat ตรงๆ ได้ทุกจุด */
export async function apiAssistantChatWithContext(userMessage: string): Promise<ChatMessage> {
  const { message, context } = await buildContextualMessage(userMessage);
  return apiAssistantChat(message, context);
}
