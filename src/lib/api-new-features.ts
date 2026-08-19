// ==========================================================================
// API functions for Export/Backup, Friends/Leaderboard, Notification Settings
// and guarded Friend Location Sharing.
//
// IMPORTANT: the realtime location endpoints are contracts for the backend.
// The frontend feature remains disabled by default until those endpoints exist.
// ==========================================================================

import { apiFetch } from "./api";

// ---------- Export / Backup ----------
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

// ---------- Friend Location Sharing ----------
export interface FriendLocation {
  friendId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speedMps?: number;
  updatedAt: string;
}

export interface FriendLocationSharingStatus {
  enabled: boolean;
  visibleToConfirmedFriends: boolean;
  updatedAt?: string;
}

export function apiFriendLocationSharingStatus() {
  return apiFetch<FriendLocationSharingStatus>("/friends/location/status");
}

export function apiFriendLocationShare(enabled: boolean) {
  return apiFetch<FriendLocationSharingStatus>("/friends/location/share", {
    method: "POST",
    body: { enabled },
  });
}

export function apiFriendLocationPublish(payload: Omit<FriendLocation, "updatedAt">) {
  return apiFetch<{ success: boolean }>("/friends/location/publish", {
    method: "POST",
    body: payload,
  });
}

export function apiFriendLocations() {
  return apiFetch<FriendLocation[]>("/friends/location/live");
}

// ---------- Notification Settings ----------
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
