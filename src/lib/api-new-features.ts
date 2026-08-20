// API adapter for the Claude frontend additions. All requests use the existing
// authenticated apiFetch client; no health values are mocked.
import { apiFetch } from "./api";

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

export type WeeklyInsight = { headline: string; daysLogged: number; avgKcal: number; daysOnGoal: number; totalSteps: number; totalWorkoutMinutes: number; streakChange: number; bestDay: { date: string; kcal: number } | null; tips: string[]; };
export function apiInsightWeekly(): Promise<WeeklyInsight> {
  return apiFetch<WeeklyInsight>("/api/insight/weekly");
}

export type FriendLocation = { friendId: string; lat: number; lng: number; accuracy: number; heading?: number; speedMps?: number; updatedAt?: string; };
export function apiFriendLocationPublish(input: Omit<FriendLocation, "updatedAt">) { return apiFetch<{ success: boolean }>("/api/friends/location/publish", { method: "POST", body: input }); }
export function apiFriendLocationShare(enabled: boolean) { return apiFetch<{ success: boolean }>("/api/friends/location/share", { method: "POST", body: { enabled } }); }
export function apiFriendLocationSharingStatus() { return apiFetch<{ enabled: boolean; visibleToConfirmedFriends: boolean }>("/api/friends/location/status"); }
