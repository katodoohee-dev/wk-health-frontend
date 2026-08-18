// ==========================================================================
// API functions à¸ªà¸³à¸«à¸£à¸±à¸š 3 à¸Ÿà¸µà¹€à¸ˆà¸­à¸£à¹Œà¹ƒà¸«à¸¡à¹ˆ: Export/Backup, Friends/Leaderboard,
// Notification Settings
//
// âš ï¸ à¸ªà¸³à¸„à¸±à¸: endpoint à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡à¸™à¸µà¹‰ "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸­à¸¢à¸¹à¹ˆà¸ˆà¸£à¸´à¸‡" à¹ƒà¸™ backend
// (Express + SQLite à¹à¸¢à¸à¹‚à¸›à¸£à¹€à¸ˆà¸à¸•à¹Œà¸•à¸²à¸¡à¸—à¸µà¹ˆà¸£à¸°à¸šà¸¸à¹ƒà¸™ api.ts) â€” à¸•à¹‰à¸­à¸‡à¹„à¸›à¸ªà¸£à¹‰à¸²à¸‡ route
// à¹€à¸«à¸¥à¹ˆà¸²à¸™à¸µà¹‰à¸—à¸µà¹ˆ backend à¸à¹ˆà¸­à¸™ à¹„à¸Ÿà¸¥à¹Œà¸™à¸µà¹‰à¹€à¸‚à¸µà¸¢à¸™à¸•à¸²à¸¡ pattern apiFetch<T>() à¹€à¸”à¸´à¸¡à¸‚à¸­à¸‡
// à¸£à¸°à¸šà¸š à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µà¹€à¸¡à¸·à¹ˆà¸­ backend à¸žà¸£à¹‰à¸­à¸¡ à¹à¸„à¹ˆ import à¹„à¸›à¸£à¸§à¸¡à¸à¸±à¸š api.ts
// ==========================================================================

import { apiFetch } from "./api";

// ---------- Export / Backup ----------
// à¸•à¹‰à¸­à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¸—à¸µà¹ˆ backend: POST /export, GET /export/history
export type ExportFormat = "pdf" | "csv";
export type ExportRange = "7d" | "30d" | "90d" | "all";

export interface ExportHistoryItem {
  id: string;
  format: ExportFormat;
  range: ExportRange;
  createdAt: string;
}

export function apiExportRequest(params: { format: ExportFormat; range: ExportRange }) {
  return apiFetch<{ downloadUrl: string }>("/export", { method: "POST", body: params });
}

export function apiExportHistory() {
  return apiFetch<ExportHistoryItem[]>("/export/history");
}

// ---------- Friends / Leaderboard ----------
// à¸•à¹‰à¸­à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¸—à¸µà¹ˆ backend: GET /friends, POST /friends/cheer/:id,
// GET /friends/invite-code, POST /friends/add, GET /stats/week-summary
export interface Friend {
  id: string;
  name: string;
  avatar?: string;
  streak: number;
}

export function apiFriendsList() {
  return apiFetch<Friend[]>("/friends");
}

export function apiFriendsCheer(friendId: string) {
  return apiFetch<{ success: boolean }>(`/friends/cheer/${friendId}`, { method: "POST" });
}

export function apiFriendsInviteCode() {
  return apiFetch<{ code: string }>("/friends/invite-code");
}

export function apiFriendsAdd(code: string) {
  return apiFetch<{ success: boolean }>("/friends/add", { method: "POST", body: { code } });
}

export function apiStatsWeekSummary() {
  return apiFetch<{ streak: number; avgKcal: number; daysOnGoal: number }>("/stats/week-summary");
}

// ---------- Notification Settings ----------
// à¸•à¹‰à¸­à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¸—à¸µà¹ˆ backend: GET /notifications/settings,
// PATCH /notifications/settings, POST /notifications/test
export interface NotificationSettings {
  mealReminder: boolean;
  waterReminder: boolean;
  streakRisk: boolean;
  weeklyInsight: boolean;
  smartTiming: boolean;
  quietStart: string;
  quietEnd: string;
}

export function apiNotificationSettings() {
  return apiFetch<NotificationSettings>("/notifications/settings");
}

export function apiNotificationUpdate(patch: Partial<NotificationSettings>) {
  return apiFetch<NotificationSettings>("/notifications/settings", { method: "PATCH", body: patch });
}

export function apiNotificationTest() {
  return apiFetch<{ success: boolean }>("/notifications/test", { method: "POST" });
}

/**
 * Weekly health insight API
 * Returns weekly health insight data from the backend.
 */
export async function apiInsightWeekly(input?: unknown) {
  const baseUrl =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    "";

  const url = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/api/insight/weekly`
    : "/api/insight/weekly";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input ?? {}),
  });

  if (!response.ok) {
    throw new Error(
      `Weekly insight API failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}
