// ชั้นเชื่อมต่อ REST API จริง (Express + SQLite แยกโปรเจกต์)
// Production backend: wk-health-backend (Render)
// Override ได้ผ่าน VITE_API_BASE_URL
export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "https://wk-health-backend.onrender.com";

export const TOKEN_KEY = "wk_token";

export function getToken(): string | null { if (typeof window === "undefined") return null; return window.localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string | null) { if (typeof window === "undefined") return; if (token) window.localStorage.setItem(TOKEN_KEY, token); else window.localStorage.removeItem(TOKEN_KEY); }
export class ApiError extends Error { status: number; constructor(message: string, status = 0) { super(message); this.name = "ApiError"; this.status = status; } }
type Json = Record<string, unknown>;

export async function apiFetch<T = Json>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = getToken();
  const sameOriginAuth = path.startsWith("/api/auth/");
  const url = sameOriginAuth ? path : `${API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new ApiError(sameOriginAuth ? "ระบบเข้าสู่ระบบเชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้ง" : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตหรือค่า API base URL");
  }
  let data: Json = {};
  try { data = (await res.json()) as Json; } catch { if (!res.ok) throw new ApiError(`เกิดข้อผิดพลาด (${res.status})`, res.status); }
  if (!res.ok || data["success"] === false) {
    const msg = (typeof data["error"] === "string" && data["error"]) || (typeof data["message"] === "string" && data["message"]) || `เกิดข้อผิดพลาด (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export function pick<T>(obj: unknown, keys: string[], fallback: T): T { if (!obj || typeof obj !== "object") return fallback; const rec = obj as Record<string, unknown>; for (const k of keys) { const v = rec[k]; if (v !== undefined && v !== null) return v as T; } return fallback; }
export function num(v: unknown, d = 0): number { const n = typeof v === "string" ? Number(v) : (v as number); return Number.isFinite(n) ? n : d; }
export function todayISO(d: Date = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export type ApiUser = { id?: string | number; name?: string; email?: string; goalKcal?: number; goal_kcal?: number; weightKg?: number; heightCm?: number; proteinGoal?: number; carbGoal?: number; fatGoal?: number; streak?: number; [k: string]: unknown };
export type AuthPayload = { token: string; user: ApiUser | null };
function normalizeUser(u: ApiUser | null): ApiUser | null { if (!u || typeof u !== "object") return null; return { ...u, name: pick<string>(u, ["name", "displayName", "display_name"], ""), weightKg: num(pick(u, ["weightKg", "weight_kg"], 0)), heightCm: num(pick(u, ["heightCm", "height_cm"], 0)), goalKcal: num(pick(u, ["goalKcal", "goal_kcal"], 2000), 2000), proteinGoal: num(pick(u, ["proteinGoal", "goal_protein"], 0)), carbGoal: num(pick(u, ["carbGoal", "goal_carb"], 0)), fatGoal: num(pick(u, ["fatGoal", "goal_fat"], 0)) }; }
function readAuth(data: Json): AuthPayload { const token = pick<string>(data, ["token", "accessToken", "access_token"], ""); const user = normalizeUser(pick<ApiUser | null>(data, ["user", "profile", "data"], null)); return { token, user }; }
export async function apiLogin(email: string, password: string) { return readAuth(await apiFetch("/api/auth/login", { method: "POST", body: { email, password } })); }
export async function apiRegister(input: { name: string; email: string; password: string }) { return readAuth(await apiFetch("/api/auth/register", { method: "POST", body: { email: input.email, password: input.password, displayName: input.name } })); }
export async function apiLogout() { try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* local logout still wins */ } }
export async function apiMe(): Promise<ApiUser | null> { const data = await apiFetch("/api/auth/me"); return normalizeUser(pick<ApiUser | null>(data, ["user", "profile", "data"], null)); }
export async function apiUpdateMe(patch: Partial<ApiUser> & { name?: string }): Promise<ApiUser | null> { const { name, ...rest } = patch; const body: Json = { ...rest }; if (name !== undefined) body["displayName"] = name; await apiFetch("/api/auth/me", { method: "PATCH", body }); return apiMe(); }

/* ----------------------------- Scan ----------------------------- */
export type NutritionResult = { name: string; kcal: number; protein: number; carb: number; fat: number; items: { label: string; grams?: number; kcal: number }[]; tips?: string; confidence?: number };
export async function apiVision(imageBase64: string, mimeType = "image/jpeg"): Promise<string> { const data = await apiFetch("/api/scan/vision", { method: "POST", body: { imageBase64, mimeType } }); return pick<string>(data, ["description", "text", "result", "data"], ""); }
export async function apiCalc(description: string): Promise<NutritionResult> { const data = await apiFetch("/api/scan/calc", { method: "POST", body: { description } }); const raw = pick<Json>(data, ["nutrition", "result", "data"], data); const rawItems = pick<Json[]>(raw, ["items", "ingredients", "breakdown"], []); return { name: pick<string>(raw, ["foodName", "name", "food", "title"], description || "อาหาร"), kcal: num(pick(raw, ["calories", "kcal", "energy"], 0)), protein: num(pick(raw, ["protein", "protein_g"], 0)), carb: num(pick(raw, ["carbs", "carb", "carbohydrate"], 0)), fat: num(pick(raw, ["fat", "fat_g"], 0)), tips: pick<string>(raw, ["tips", "advice", "suggestion"], ""), confidence: num(pick(raw, ["confidence"], 0)), items: (Array.isArray(rawItems) ? rawItems : []).map((it) => ({ label: pick<string>(it, ["label", "name", "item"], "-"), grams: num(pick(it, ["grams", "amount", "qty"], 0)), kcal: num(pick(it, ["kcal", "calories"], 0)) })) }; }
export async function apiScanSave(payload: Json) { return apiFetch("/api/scan/save", { method: "POST", body: payload }); }

/* ----------------------------- Diary ----------------------------- */
export type DiaryItem = { id: string; name: string; time: string; slot: string; kcal: number; protein: number; carb: number; fat: number; emoji: string; source: string };
function readDiaryItem(raw: Json): DiaryItem { const created = String(pick(raw, ["created_at", "createdAt", "time"], "")); return { id: String(pick(raw, ["id", "_id", "uuid"], "")), name: pick<string>(raw, ["food_name", "foodName", "name", "food", "title", "description"], "ไม่ระบุชื่อ"), time: created.includes("T") ? created.slice(11, 16) : (created.length >= 16 ? created.slice(11, 16) : created), slot: pick<string>(raw, ["meal_type", "mealType", "slot", "meal"], "อื่น ๆ"), kcal: num(pick(raw, ["calories", "kcal"], 0)), protein: num(pick(raw, ["protein"], 0)), carb: num(pick(raw, ["carbs", "carb"], 0)), fat: num(pick(raw, ["fat"], 0)), emoji: pick<string>(raw, ["emoji", "icon"], "🍽️"), source: pick<string>(raw, ["source", "from"], "manual") }; }
export async function apiDiary(date: string): Promise<DiaryItem[]> { const data = await apiFetch(`/api/diary?date=${encodeURIComponent(date)}`); const list = pick<Json[]>(data, ["entries", "items", "meals", "diary", "data"], []); return (Array.isArray(list) ? list : []).map(readDiaryItem); }
export async function apiDeleteDiary(id: string) { return apiFetch(`/api/diary/${encodeURIComponent(id)}`, { method: "DELETE" }); }

/* ----------------------------- Stats ----------------------------- */
export type TodayStats = { eaten: number; burned: number; goal: number; protein: number; carb: number; fat: number; proteinGoal: number; carbGoal: number; fatGoal: number; water?: number; waterGoal?: number; streak?: number };
export async function apiStatsToday(): Promise<TodayStats> { const [stats, water, checkin] = await Promise.all([apiFetch<Json>("/api/stats/today"), apiFetch<Json>("/api/water/today").catch(() => ({})), apiFetch<Json>("/api/checkin/today").catch(() => ({}))]); const s = pick<Json>(stats, ["totals", "stats", "today", "data"], stats); return { eaten: num(pick(s, ["calories", "eaten", "eatenKcal", "totalKcal", "kcal"], 0)), burned: num(pick(s, ["burned", "burnedKcal", "burn"], 0)), goal: num(pick(s, ["goalKcal", "goal", "targetKcal"], 2000), 2000), protein: num(pick(s, ["protein"], 0)), carb: num(pick(s, ["carbs", "carb"], 0)), fat: num(pick(s, ["fat"], 0)), proteinGoal: num(pick(s, ["proteinGoal", "protein_goal"], 120), 120), carbGoal: num(pick(s, ["carbGoal", "carb_goal"], 240), 240), fatGoal: num(pick(s, ["fatGoal", "fat_goal"], 65), 65), water: num(pick(water, ["glasses", "water"], 0)), waterGoal: num(pick(water, ["goalGlasses", "waterGoal"], 8), 8), streak: num(pick(checkin, ["streak"], 0)) }; }
export type WeeklyPoint = { day: string; kcal: number; burn: number; steps: number };
export async function apiStatsWeekly(): Promise<WeeklyPoint[]> { const data = await apiFetch("/api/stats/weekly"); const list = pick<Json[]>(data, ["days", "weekly", "items", "data", "stats"], []); return (Array.isArray(list) ? list : []).map((d) => ({ day: String(pick(d, ["day", "label", "date"], "")).slice(-5), kcal: num(pick(d, ["calories", "kcal", "eaten"], 0)), burn: num(pick(d, ["burn", "burned"], 0)), steps: num(pick(d, ["steps"], 0)) })); }

/* ----------------------------- NLP ----------------------------- */
export type NlpItem = { name: string; qty: string; kcal: number; confidence: number };
export async function apiNlpAnalyze(text: string): Promise<NlpItem[]> { const data = await apiFetch("/api/nlp/analyze", { method: "POST", body: { text } }); const list = pick<Json[]>(data, ["items", "foods", "results", "data"], []); return (Array.isArray(list) ? list : []).map((i) => ({ name: pick<string>(i, ["foodName", "name", "food", "label"], "-"), qty: String(pick(i, ["qty", "quantity", "amount", "portion"], "")), kcal: num(pick(i, ["calories", "kcal"], 0)), confidence: num(pick(i, ["confidence", "score"], 0.9), 0.9) })); }

/* ----------------------------- Mood ----------------------------- */
export type MoodOption = { key: string; label: string; emoji: string; hint: string };
export type MoodMenu = { name: string; kcal: number; emoji: string; why: string };
export async function apiMoodList(): Promise<MoodOption[]> { const data = await apiFetch("/api/mood/list"); const list = pick<Json[]>(data, ["moods", "items", "data", "list"], []); return (Array.isArray(list) ? list : []).map((m) => ({ key: String(pick(m, ["mood_id", "key", "id", "value", "mood", "name"], "")), label: pick<string>(m, ["name_th", "label", "name", "title"], ""), emoji: pick<string>(m, ["icon", "emoji"], "🙂"), hint: pick<string>(m, ["description", "hint", "subtitle"], "") })); }
export async function apiMoodToday() { return apiFetch("/api/mood/today"); }
export async function apiMoodSave(payload: Json) { return apiFetch("/api/mood", { method: "POST", body: payload }); }

/* ----------------------------- Generic helpers ----------------------------- */
export async function apiAssistantHistory(limit = 50) { return apiFetch(`/api/assistant/history?limit=${limit}`); }
export async function apiAssistantChat(message: string) { return apiFetch("/api/assistant/chat", { method: "POST", body: { message } }); }
export async function apiHealth() { return apiFetch("/health"); }
