import {
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
  const value = <T,>(i: number, fallback: T): T => results[i].status === "fulfilled" ? results[i].value as T : fallback;
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
