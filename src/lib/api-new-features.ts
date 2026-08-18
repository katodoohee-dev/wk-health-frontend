// ==========================================================================
// API functions สำหรับ 3 ฟีเจอร์ใหม่: Export/Backup, Friends/Leaderboard,
// Notification Settings
//
// ⚠️ สำคัญ: endpoint ทั้งหมดด้านล่างนี้ "ยังไม่มีอยู่จริง" ใน backend
// (Express + SQLite แยกโปรเจกต์ตามที่ระบุใน api.ts) — ต้องไปสร้าง route
// เหล่านี้ที่ backend ก่อน ไฟล์นี้เขียนตาม pattern apiFetch<T>() เดิมของ
// ระบบ พร้อมใช้งานได้ทันทีเมื่อ backend พร้อม แค่ import ไปรวมกับ api.ts
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
  return apiFetch<{ downloadUrl: string }>("/export", { method: "POST", body: params });
}

export function apiExportHistory() {
  return apiFetch<ExportHistoryItem[]>("/export/history");
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
  return apiFetch<NotificationSettings>("/notifications/settings");
}

export function apiNotificationUpdate(patch: Partial<NotificationSettings>) {
  return apiFetch<NotificationSettings>("/notifications/settings", { method: "PATCH", body: patch });
}

export function apiNotificationTest() {
  return apiFetch<{ success: boolean }>("/notifications/test", { method: "POST" });
}
