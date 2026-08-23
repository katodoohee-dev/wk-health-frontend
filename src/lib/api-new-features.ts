// ========================================================================
// API functions for Export/Backup, Friends/Leaderboard, Notification Settings
// and Friend Location Sharing.
// ========================================================================

import { apiFetch, getToken } from "./api";

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

async function localLocationFetch<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const token = getToken();
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  let data: any = {};
  try { data = await response.json(); } catch { /* handled by status */ }
  if (!response.ok || data?.success === false) {
    throw new Error(String(data?.error || `เกิดข้อผิดพลาด (${response.status})`));
  }
  return data as T;
}

export function apiFriendLocationSharingStatus() {
  return localLocationFetch<FriendLocationSharingStatus>("/api/friends/location/status");
}

export function apiFriendLocationShare(enabled: boolean) {
  return localLocationFetch<FriendLocationSharingStatus>("/api/friends/location/share", { method: "POST", body: { enabled } });
}

export function apiFriendLocationPublish(payload: Omit<FriendLocation, "updatedAt">) {
  return localLocationFetch<{ success: boolean }>("/api/friends/location/publish", { method: "POST", body: payload });
}

export function apiFriendLocations() {
  return localLocationFetch<FriendLocation[]>("/api/friends/location/live");
}

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

export async function apiInsightWeekly(input?: unknown) {
  const baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "";
  const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/insight/weekly` : "/api/insight/weekly";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
  if (!response.ok) throw new Error(`Weekly insight API failed: ${response.status} ${response.statusText}`);
  return response.json();
}
