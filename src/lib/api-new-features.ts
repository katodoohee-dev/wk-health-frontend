// API adapter for the Claude frontend additions. All requests use the existing
// authenticated apiFetch client; no health values are mocked.
import { apiFetch, apiStatsWeekly, apiWorkoutHistory, type WeeklyPoint } from "./api";

export type ExportFormat = "pdf" | "csv";
export type ExportRange = "7d" | "30d" | "90d" | "all";
export interface ExportHistoryItem { id: string; format: ExportFormat; range: ExportRange; createdAt: string; }
export function apiExportRequest(params: { format: ExportFormat; range: ExportRange }) { return apiFetch<{ downloadUrl: string }>("/api/export", { method: "POST", body: params }); }
export function apiExportHistory() { return apiFetch<ExportHistoryItem[]>("/api/export/history"); }

export interface Friend { id: string; name: string; avatar?: string; streak: number; }
export function apiFriendsList() { return apiFetch<Friend[]>("/api/friends"); }
export function apiFriendsCheer(friendId: string) { return apiFetch<{ success: boolean }>(`/api/friends/cheer/${friendId}`, { method: "POST" }); }
export function apiFriendsInviteCode() { return apiFetch<{ code: string }>("/api/friends/invite-code"); }
export function apiFriendsAdd(code: string) { return apiFetch<{ success: boolean }>("/api/friends/add", { method: "POST", body: { code } }); }
export function apiStatsWeekSummary() { return apiFetch<{ streak: number; avgKcal: number; daysOnGoal: number }>("/api/stats/week-summary"); }

export interface NotificationSettings { mealReminder: boolean; waterReminder: boolean; streakRisk: boolean; weeklyInsight: boolean; smartTiming: boolean; quietStart: string; quietEnd: string; }
export function apiNotificationSettings() { return apiFetch<NotificationSettings>("/api/notifications/settings"); }
export function apiNotificationUpdate(patch: Partial<NotificationSettings>) { return apiFetch<NotificationSettings>("/api/notifications/settings", { method: "PATCH", body: patch }); }
export function apiNotificationTest() { return apiFetch<{ success: boolean }>("/api/notifications/test", { method: "POST" }); }

export type WeeklyInsight = { headline: string; daysLogged: number; avgKcal: number; daysOnGoal: number; totalSteps: number; totalWorkoutMinutes: number; bestDay: { date: string; kcal: number } | null; tips: string[]; };
export async function apiInsightWeekly(): Promise<WeeklyInsight> {
  const [weekly, workouts] = await Promise.all([apiStatsWeekly(), apiWorkoutHistory()]);
  const points: WeeklyPoint[] = Array.isArray(weekly) ? weekly : [];
  const daysLogged = points.filter((p) => p.kcal > 0).length;
  const avgKcal = daysLogged ? Math.round(points.reduce((sum, p) => sum + p.kcal, 0) / daysLogged) : 0;
  const totalSteps = points.reduce((sum, p) => sum + p.steps, 0);
  const totalWorkoutMinutes = (Array.isArray(workouts) ? workouts : []).reduce((sum, w) => sum + w.minutes, 0);
  const daysOnGoal = points.filter((p) => p.kcal > 0 && p.burn >= 0).length;
  const best = points.filter((p) => p.kcal > 0).sort((a, b) => Math.abs(a.kcal - avgKcal) - Math.abs(b.kcal - avgKcal))[0];
  const tips: string[] = [];
  if (daysLogged < 7) tips.push("บันทึกอาหารให้ครบทุกวัน เพื่อให้ภาพรวมแม่นยำขึ้น");
  if (totalSteps < 50000) tips.push("เพิ่มการเดินในแต่ละวันอีกเล็กน้อยเพื่อขยับกิจกรรมให้สม่ำเสมอ");
  if (totalWorkoutMinutes === 0) tips.push("ลองบันทึกการออกกำลังกายอย่างน้อย 1 ครั้งในสัปดาห์หน้า");
  if (!tips.length) tips.push("รักษาความสม่ำเสมอของอาหาร การเดิน และการออกกำลังกายต่อไป");
  return { headline: daysLogged ? `สัปดาห์นี้คุณบันทึกข้อมูลอาหารแล้ว ${daysLogged}/7 วัน และมีค่าเฉลี่ย ${avgKcal} kcal/วันที่บันทึก` : "ยังมีข้อมูลรายสัปดาห์ไม่เพียงพอสำหรับสรุปแนวโน้ม", daysLogged, avgKcal, daysOnGoal, totalSteps, totalWorkoutMinutes, bestDay: best ? { date: best.day, kcal: best.kcal } : null, tips };
}

// Friend location sharing endpoints are same-origin server routes. They are
// guarded by the existing auth/session flow and are intentionally no-op only
// when the server rejects the request.
export type FriendLocation = { friendId: string; lat: number; lng: number; accuracy: number; heading?: number; speedMps?: number; updatedAt?: string; };
export function apiFriendLocationPublish(input: Omit<FriendLocation, "updatedAt">) { return apiFetch<{ success: boolean }>("/api/friends/location/publish", { method: "POST", body: input }); }
export function apiFriendLocationShare(enabled: boolean) { return apiFetch<{ success: boolean }>("/api/friends/location/share", { method: "POST", body: { enabled } }); }
export function apiFriendLocationSharingStatus() { return apiFetch<{ enabled: boolean; visibleToConfirmedFriends: boolean }>("/api/friends/location/status"); }
