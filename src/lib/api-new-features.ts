// ========================================================================
// API functions for Export/Backup, Friends/Leaderboard, Notification Settings
// and Friend Location Sharing.
// ========================================================================

import { apiFetch } from "./api";

export type ExportFormat = "pdf" | "csv";
export type ExportRange = "7d" | "30d" | "90d" | "all";

export interface ExportHistoryItem { id: string; format: ExportFormat; range: ExportRange; createdAt: string; }

export function apiExportRequest(params: { format: ExportFormat; range: ExportRange }) { return apiFetch<{ downloadUrl: string }>("/export", { method: "POST", body: params }); }
export function apiExportHistory() { return apiFetch<ExportHistoryItem[]>("/export/history"); }

export interface Friend { id: string; name: string; avatar?: string; streak: number; }
export function apiFriendsList() { return apiFetch<Friend[]>("/friends"); }
export function apiFriendsCheer(friendId: string) { return apiFetch<{ success: boolean }>(`/friends/cheer/${friendId}`, { method: "POST" }); }
export function apiFriendsInviteCode() { return apiFetch<{ code: string }>("/friends/invite-code"); }
export function apiFriendsAdd(code: string) { return apiFetch<{ success: boolean }>("/friends/add", { method: "POST", body: { code } }); }
export function apiStatsWeekSummary() { return apiFetch<{ streak: number; avgKcal: number; daysOnGoal: number }>("/stats/week-summary"); }

export interface FriendLocation { friendId: string; lat: number; lng: number; accuracy?: number; heading?: number; speedMps?: number; updatedAt: string; }
export interface FriendLocationSharingStatus { enabled: boolean; visibleToConfirmedFriends: boolean; updatedAt?: string; }

export function apiFriendLocationSharingStatus() { return apiFetch<FriendLocationSharingStatus>("/api/friends/location/status"); }
export function apiFriendLocationShare(enabled: boolean) { return apiFetch<FriendLocationSharingStatus>("/api/friends/location/share", { method: "POST", body: { enabled } }); }
export function apiFriendLocationPublish(payload: Omit<FriendLocation, "updatedAt">) { return apiFetch<{ success: boolean }>("/api/friends/location/publish", { method: "POST", body: payload }); }
export function apiFriendLocations() { return apiFetch<FriendLocation[]>("/api/friends/location/live"); }

export interface NotificationSettings { mealReminder: boolean; waterReminder: boolean; streakRisk: boolean; weeklyInsight: boolean; smartTiming: boolean; quietStart: string; quietEnd: string; }
export function apiNotificationSettings() { return apiFetch<NotificationSettings>("/notifications/settings"); }
export function apiNotificationUpdate(patch: Partial<NotificationSettings>) { return apiFetch<NotificationSettings>("/notifications/settings", { method: "PATCH", body: patch }); }
export function apiNotificationTest() { return apiFetch<{ success: boolean }>("/notifications/test", { method: "POST" }); }

export async function apiInsightWeekly(input?: unknown) {
  return apiFetch("/api/insight/weekly", { method: "POST", body: input ?? {} });
}
