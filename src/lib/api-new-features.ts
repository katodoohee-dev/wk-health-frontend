// ==========================================================================
// API functions สำหรับ 3 ฟีเจอร์ใหม่: Export/Backup, Friends/Leaderboard,
// Notification Settings
//
// backend endpoints มีอยู่จริงแล้วที่ wk-health-backend
// (src/routes/export.ts, friends.ts, notifications.ts)
// หมายเหตุ: /api/notifications/test แค่ log ฝั่ง server เท่านั้น ยังไม่ใช่
// push แจ้งเตือนจริงบนมือถือ จนกว่าจะตั้งค่า VAPID key + Service Worker
// ==========================================================================

import { apiFetch } from "./api";

// ---------- Export / Backup ----------
// ต้องสร้างที่ backend: POST /export, GET /export/history
export type ExportFormat = "pdf" | "csv";
export type ExportRange = "7d" | "30d" | "90d" | "all";

export interface ExportHistoryItem {
  id: string;
  format: ExportFormat;
  range: ExportRange;
  createdAt: string;
}

export function apiExportRequest(params: { format: ExportFormat; range: ExportRange }) {
  return apiFetch<{ downloadUrl: string }>("/api/export", { method: "POST", body: params });
}

export function apiExportHistory() {
  return apiFetch<ExportHistoryItem[]>("/api/export/history");
}

// ---------- Friends / Leaderboard ----------
// ต้องสร้างที่ backend: GET /friends, POST /friends/cheer/:id,
// GET /friends/invite-code, POST /friends/add, GET /stats/week-summary
export interface Friend {
  id: string;
  name: string;
  avatar?: string;
  streak: number;
}

export function apiFriendsList() {
  return apiFetch<Friend[]>("/api/friends");
}

export function apiFriendsCheer(friendId: string) {
  return apiFetch<{ success: boolean }>(`/api/friends/cheer/${friendId}`, { method: "POST" });
}

export function apiFriendsInviteCode() {
  return apiFetch<{ code: string }>("/api/friends/invite-code");
}

export function apiFriendsAdd(code: string) {
  return apiFetch<{ success: boolean }>("/api/friends/add", { method: "POST", body: { code } });
}

export function apiStatsWeekSummary() {
  return apiFetch<{ streak: number; avgKcal: number; daysOnGoal: number }>("/api/stats/week-summary");
}

// ---------- Notification Settings ----------
// ต้องสร้างที่ backend: GET /notifications/settings,
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
  return apiFetch<NotificationSettings>("/api/notifications/settings");
}

export function apiNotificationUpdate(patch: Partial<NotificationSettings>) {
  return apiFetch<NotificationSettings>("/api/notifications/settings", { method: "PATCH", body: patch });
}

export function apiNotificationTest() {
  return apiFetch<{ success: boolean }>("/api/notifications/test", { method: "POST" });
}

// ---------- Workout logging (ใช้กับ VoiceControl) ----------
export function apiWorkoutLog(input: { exerciseName: string; minutes: number; weightKg?: number; kcalOverride?: number }) {
  return apiFetch<{ success: boolean; id: number; kcalBurned: number }>("/api/workout/log", {
    method: "POST",
    body: input,
  });
}

// ---------- Water tracking ----------
// backend endpoints มีอยู่จริงแล้วที่ wk-health-backend (src/routes/water.ts)
export interface WaterToday {
  glasses: number;
  goalGlasses: number;
}

export function apiWaterToday() {
  return apiFetch<WaterToday>("/api/water/today");
}

export function apiWaterAdd(delta: number) {
  return apiFetch<{ success: boolean; glasses: number }>("/api/water/add", { method: "POST", body: { delta } });
}

export function apiWaterSetGoal(goalGlasses: number) {
  return apiFetch<{ success: boolean }>("/api/water/goal", { method: "PATCH", body: { goalGlasses } });
}

// ---------- Weekly Insight ----------
// backend endpoint มีอยู่จริงแล้วที่ wk-health-backend (src/routes/insight.ts)
export interface WeeklyInsight {
  avgKcal: number;
  avgProtein: number;
  daysLogged: number;
  daysOnGoal: number;
  bestDay: { date: string; kcal: number } | null;
  totalSteps: number;
  totalWorkoutMinutes: number;
  streakChange: number;
  headline: string;
  tips: string[];
}

export function apiInsightWeekly() {
  return apiFetch<WeeklyInsight>("/api/insight/weekly");
}

// ---------- Web Push (VAPID) — subscribe จริง ----------
export function apiNotificationVapidPublicKey() {
  return apiFetch<{ publicKey: string }>("/api/notifications/vapid-public-key");
}

export function apiNotificationSubscribe(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  return apiFetch<{ success: boolean }>("/api/notifications/subscribe", { method: "POST", body: sub });
}

export function apiNotificationUnsubscribe(endpoint: string) {
  return apiFetch<{ success: boolean }>("/api/notifications/unsubscribe", { method: "POST", body: { endpoint } });
}
