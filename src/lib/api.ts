// ชั้นเชื่อมต่อ REST API จริง (Express + SQLite แยกโปรเจกต์)
// base URL ตั้งค่าได้ผ่าน VITE_API_BASE_URL

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "https://https-sites-google-com-sbp-ac-th.onrender.com";

export const TOKEN_KEY = "wk_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Json = Record<string, unknown>;

export async function apiFetch<T = Json>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตหรือค่า API base URL");
  }

  let data: Json = {};
  try {
    data = (await res.json()) as Json;
  } catch {
    if (!res.ok) throw new ApiError(`เกิดข้อผิดพลาด (${res.status})`, res.status);
  }

  if (!res.ok || data["success"] === false) {
    const msg =
      (typeof data["error"] === "string" && data["error"]) ||
      (typeof data["message"] === "string" && data["message"]) ||
      `เกิดข้อผิดพลาด (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

/** ดึงค่าแรกที่เจอจากหลายชื่อ key (backend อาจตั้งชื่อไม่ตรงกัน) */
export function pick<T>(obj: unknown, keys: string[], fallback: T): T {
  if (!obj || typeof obj !== "object") return fallback;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return fallback;
}

export function num(v: unknown, d = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : d;
}

export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/* ----------------------------- Auth ----------------------------- */

export type ApiUser = {
  id?: string | number;
  name?: string;
  email?: string;
  goalKcal?: number;
  goal_kcal?: number;
  proteinGoal?: number;
  carbGoal?: number;
  fatGoal?: number;
  streak?: number;
  [k: string]: unknown;
};

export type AuthPayload = { token: string; user: ApiUser | null };

function readAuth(data: Json): AuthPayload {
  const token = pick<string>(data, ["token", "accessToken", "access_token"], "");
  const user = pick<ApiUser | null>(data, ["user", "profile", "data"], null);
  return { token, user };
}

export async function apiLogin(email: string, password: string) {
  return readAuth(await apiFetch("/api/auth/login", { method: "POST", body: { email, password } }));
}

export async function apiRegister(input: { name: string; email: string; password: string }) {
  return readAuth(await apiFetch("/api/auth/register", { method: "POST", body: input }));
}

export async function apiLogout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* ออกจากระบบฝั่ง client ได้เสมอ */
  }
}

export async function apiMe(): Promise<ApiUser | null> {
  const data = await apiFetch("/api/auth/me");
  return pick<ApiUser | null>(data, ["user", "profile", "data"], null);
}

export async function apiUpdateMe(patch: Partial<ApiUser>): Promise<ApiUser | null> {
  const data = await apiFetch("/api/auth/me", { method: "PATCH", body: patch });
  return pick<ApiUser | null>(data, ["user", "profile", "data"], null);
}

/* ----------------------------- Scan ----------------------------- */

export type NutritionResult = {
  name: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  items: { label: string; grams?: number; kcal: number }[];
  tips?: string;
  confidence?: number;
};

export async function apiVision(imageBase64: string): Promise<string> {
  const data = await apiFetch("/api/scan/vision", {
    method: "POST",
    body: { image: imageBase64, imageBase64 },
  });
  return pick<string>(data, ["description", "text", "result", "data"], "");
}

export async function apiCalc(description: string): Promise<NutritionResult> {
  const data = await apiFetch("/api/scan/calc", {
    method: "POST",
    body: { description, text: description },
  });
  const raw = pick<Json>(data, ["nutrition", "result", "data"], data);
  const rawItems = pick<Json[]>(raw, ["items", "ingredients", "breakdown"], []);
  return {
    name: pick<string>(raw, ["name", "food", "title"], description || "อาหาร"),
    kcal: num(pick(raw, ["kcal", "calories", "energy"], 0)),
    protein: num(pick(raw, ["protein", "protein_g"], 0)),
    carb: num(pick(raw, ["carb", "carbs", "carbohydrate"], 0)),
    fat: num(pick(raw, ["fat", "fat_g"], 0)),
    tips: pick<string>(raw, ["tips", "advice", "suggestion"], ""),
    confidence: num(pick(raw, ["confidence"], 0)),
    items: (Array.isArray(rawItems) ? rawItems : []).map((it) => ({
      label: pick<string>(it, ["label", "name", "item"], "-"),
      grams: num(pick(it, ["grams", "amount", "qty"], 0)),
      kcal: num(pick(it, ["kcal", "calories"], 0)),
    })),
  };
}

export async function apiScanSave(payload: Json) {
  return apiFetch("/api/scan/save", { method: "POST", body: payload });
}

/* ----------------------------- Diary ----------------------------- */

export type DiaryItem = {
  id: string;
  name: string;
  time: string;
  slot: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  emoji: string;
  source: string;
};

function readDiaryItem(raw: Json): DiaryItem {
  return {
    id: String(pick(raw, ["id", "_id", "uuid"], Math.random().toString(36).slice(2))),
    name: pick<string>(raw, ["name", "food", "title", "description"], "ไม่ระบุชื่อ"),
    time: String(pick(raw, ["time", "createdAt", "created_at"], "")).slice(11, 16) ||
      pick<string>(raw, ["time"], ""),
    slot: pick<string>(raw, ["slot", "meal", "mealType", "meal_type"], "อื่น ๆ"),
    kcal: num(pick(raw, ["kcal", "calories"], 0)),
    protein: num(pick(raw, ["protein"], 0)),
    carb: num(pick(raw, ["carb", "carbs"], 0)),
    fat: num(pick(raw, ["fat"], 0)),
    emoji: pick<string>(raw, ["emoji", "icon"], "🍽️"),
    source: pick<string>(raw, ["source", "from"], "manual"),
  };
}

export async function apiDiary(date: string): Promise<DiaryItem[]> {
  const data = await apiFetch(`/api/diary?date=${encodeURIComponent(date)}`);
  const list = pick<Json[]>(data, ["items", "meals", "diary", "entries", "data"], []);
  return (Array.isArray(list) ? list : []).map(readDiaryItem);
}

export async function apiDeleteDiary(id: string) {
  return apiFetch(`/api/diary/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ----------------------------- Stats ----------------------------- */

export type TodayStats = {
  eaten: number;
  burned: number;
  goal: number;
  protein: number;
  carb: number;
  fat: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  water?: number;
  waterGoal?: number;
  streak?: number;
};

export async function apiStatsToday(): Promise<TodayStats> {
  const data = await apiFetch("/api/stats/today");
  const s = pick<Json>(data, ["stats", "today", "data"], data);
  return {
    eaten: num(pick(s, ["eaten", "eatenKcal", "totalKcal", "calories", "kcal"], 0)),
    burned: num(pick(s, ["burned", "burnedKcal", "burn"], 0)),
    goal: num(pick(s, ["goal", "goalKcal", "targetKcal"], 2000), 2000),
    protein: num(pick(s, ["protein"], 0)),
    carb: num(pick(s, ["carb", "carbs"], 0)),
    fat: num(pick(s, ["fat"], 0)),
    proteinGoal: num(pick(s, ["proteinGoal", "protein_goal"], 120), 120),
    carbGoal: num(pick(s, ["carbGoal", "carb_goal"], 240), 240),
    fatGoal: num(pick(s, ["fatGoal", "fat_goal"], 65), 65),
    water: num(pick(s, ["water", "waterGlasses"], 0)),
    waterGoal: num(pick(s, ["waterGoal"], 8), 8),
    streak: num(pick(s, ["streak"], 0)),
  };
}

export type WeeklyPoint = { day: string; kcal: number; burn: number; steps: number };

export async function apiStatsWeekly(): Promise<WeeklyPoint[]> {
  const data = await apiFetch("/api/stats/weekly");
  const list = pick<Json[]>(data, ["days", "weekly", "items", "data", "stats"], []);
  return (Array.isArray(list) ? list : []).map((d) => ({
    day: String(pick(d, ["day", "label", "date"], "")).slice(-5),
    kcal: num(pick(d, ["kcal", "eaten", "calories"], 0)),
    burn: num(pick(d, ["burn", "burned"], 0)),
    steps: num(pick(d, ["steps"], 0)),
  }));
}

/* ----------------------------- NLP ----------------------------- */

export type NlpItem = { name: string; qty: string; kcal: number; confidence: number };

export async function apiNlpAnalyze(text: string): Promise<NlpItem[]> {
  const data = await apiFetch("/api/nlp/analyze", { method: "POST", body: { text } });
  const list = pick<Json[]>(data, ["items", "foods", "results", "data"], []);
  return (Array.isArray(list) ? list : []).map((i) => ({
    name: pick<string>(i, ["name", "food", "label"], "-"),
    qty: String(pick(i, ["qty", "quantity", "amount", "portion"], "")),
    kcal: num(pick(i, ["kcal", "calories"], 0)),
    confidence: num(pick(i, ["confidence", "score"], 0.9), 0.9),
  }));
}

/* ----------------------------- Mood ----------------------------- */

export type MoodOption = { key: string; label: string; emoji: string; hint: string };
export type MoodMenu = { name: string; kcal: number; emoji: string; why: string };

export async function apiMoodList(): Promise<MoodOption[]> {
  const data = await apiFetch("/api/mood/list");
  const list = pick<Json[]>(data, ["moods", "items", "data", "list"], []);
  return (Array.isArray(list) ? list : []).map((m) => {
    const key = String(pick(m, ["key", "id", "value", "mood", "name"], ""));
    return {
      key,
      label: pick<string>(m, ["label", "name", "title"], key),
      emoji: pick<string>(m, ["emoji", "icon"], "🙂"),
      hint: pick<string>(m, ["hint", "description", "desc"], ""),
    };
  });
}

export async function apiMoodRecommend(mood: string, meal: "breakfast" | "main") {
  const data = await apiFetch(
    `/api/mood/recommend?mood=${encodeURIComponent(mood)}&meal=${meal}`,
  );
  const list = pick<Json[]>(data, ["menus", "items", "recommendations", "data"], []);
  return (Array.isArray(list) ? list : []).map<MoodMenu>((m) => ({
    name: pick<string>(m, ["name", "menu", "title"], "-"),
    kcal: num(pick(m, ["kcal", "calories"], 0)),
    emoji: pick<string>(m, ["emoji", "icon"], "🍽️"),
    why: pick<string>(m, ["why", "reason", "benefit", "description"], ""),
  }));
}

/* ----------------------------- Budget ----------------------------- */

export type BudgetPlanInput = {
  monthlyBudget: number;
  conditions: string[];
  allergies: string[];
  days: number;
};

export type BudgetMeal = { name: string; price: number; kcal: number; protein: number; emoji: string; slot?: string };
export type BudgetDay = { day: string; meals: BudgetMeal[]; total: number };
export type BudgetPlan = { days: BudgetDay[]; totalCost: number; note?: string };

export async function apiBudgetPlan(input: BudgetPlanInput): Promise<BudgetPlan> {
  const data = await apiFetch("/api/budget/plan", { method: "POST", body: input });
  const p = pick<Json>(data, ["plan", "data", "result"], data);
  const rawDays = pick<Json[]>(p, ["days", "plan", "items"], []);
  const days: BudgetDay[] = (Array.isArray(rawDays) ? rawDays : []).map((d, i) => {
    const rawMeals = pick<Json[]>(d, ["meals", "items", "menus"], []);
    const meals: BudgetMeal[] = (Array.isArray(rawMeals) ? rawMeals : []).map((m) => ({
      name: pick<string>(m, ["name", "menu", "title"], "-"),
      price: num(pick(m, ["price", "cost", "baht"], 0)),
      kcal: num(pick(m, ["kcal", "calories"], 0)),
      protein: num(pick(m, ["protein"], 0)),
      emoji: pick<string>(m, ["emoji", "icon"], "🍚"),
      slot: pick<string>(m, ["slot", "meal", "mealType"], ""),
    }));
    return {
      day: String(pick(d, ["day", "label", "date"], `วันที่ ${i + 1}`)),
      meals,
      total: num(pick(d, ["total", "cost", "totalCost"], meals.reduce((s, m) => s + m.price, 0))),
    };
  });
  return {
    days,
    totalCost: num(
      pick(p, ["totalCost", "total", "cost"], days.reduce((s, d) => s + d.total, 0)),
    ),
    note: pick<string>(p, ["note", "advice", "summary"], ""),
  };
}

/* ----------------------------- Pedometer ----------------------------- */

export type PedometerToday = {
  steps: number;
  goal: number;
  distanceKm: number;
  kcal: number;
  activeMinutes: number;
  floors: number;
  hourly: { h: string; steps: number }[];
};

export async function apiPedometerToday(): Promise<PedometerToday> {
  const data = await apiFetch("/api/pedometer/today");
  const p = pick<Json>(data, ["pedometer", "today", "data", "stats"], data);
  const hourly = pick<Json[]>(p, ["hourly", "byHour", "hours"], []);
  return {
    steps: num(pick(p, ["steps", "step"], 0)),
    goal: num(pick(p, ["goal", "stepGoal", "target"], 10000), 10000),
    distanceKm: num(pick(p, ["distanceKm", "distance", "km"], 0)),
    kcal: num(pick(p, ["kcal", "calories", "burned"], 0)),
    activeMinutes: num(pick(p, ["activeMinutes", "active_minutes", "minutes"], 0)),
    floors: num(pick(p, ["floors", "floor"], 0)),
    hourly: (Array.isArray(hourly) ? hourly : []).map((h) => ({
      h: String(pick(h, ["h", "hour", "label"], "")),
      steps: num(pick(h, ["steps", "value"], 0)),
    })),
  };
}

/**
 * FIX: backend zod schema ต้องการ {steps, distanceKm, seconds} ครบทั้ง 3 ฟิลด์
 * ของเดิมส่งแค่ {steps} ทำให้ได้ 400 เงียบๆ (ปุ่มดูเหมือนกดไม่ติด)
 * ใส่ค่า default ที่สมเหตุสมผลถ้าไม่มี distance/seconds จริงจากอุปกรณ์
 */
export async function apiPedometerLog(
  steps: number,
  opts: { distanceKm?: number; seconds?: number } = {},
) {
  const distanceKm = opts.distanceKm ?? Math.round(steps * 0.0007 * 100) / 100; // ประมาณ ~0.7m/ก้าว
  const seconds = opts.seconds ?? Math.round(steps * 0.5); // ประมาณ ~0.5 วิ/ก้าว
  return apiFetch("/api/pedometer/log", {
    method: "POST",
    body: { steps, distanceKm, seconds },
  });
}

/* ----------------------------- Body / BMI ----------------------------- */

export type BmiResult = { bmi: number; classification: string; advice?: string };

export async function apiBmi(weightKg: number, heightCm: number): Promise<BmiResult> {
  const data = await apiFetch(
    `/api/body/bmi?weightKg=${encodeURIComponent(weightKg)}&heightCm=${encodeURIComponent(heightCm)}`,
  );
  const b = pick<Json>(data, ["bmi", "result", "data"], data);
  const raw = typeof b === "object" ? b : data;
  return {
    bmi: num(pick(raw, ["bmi", "value"], num(pick(data, ["bmi"], 0)))),
    classification: pick<string>(raw, ["classification", "class", "label", "category", "status"], ""),
    advice: pick<string>(raw, ["advice", "tips", "note"], ""),
  };
}

/* ----------------------------- Workout ----------------------------- */

/**
 * FIX: backend zod schema ต้องการ enum ภาษาอังกฤษเป๊ะๆ
 * goal: 'weight_loss' | 'maintenance' | 'muscle_gain'
 * level: 'beginner' | 'intermediate' | 'advanced'
 * ของเดิม UI ส่ง label ภาษาไทยตรงๆ ("ลดน้ำหนัก") ทำให้ zod validation fail (400)
 */
export type WorkoutGoal = "weight_loss" | "maintenance" | "muscle_gain";
export type WorkoutLevel = "beginner" | "intermediate" | "advanced";

export const WORKOUT_GOAL_OPTIONS: { value: WorkoutGoal; label: string }[] = [
  { value: "weight_loss", label: "ลดน้ำหนัก" },
  { value: "maintenance", label: "รักษาน้ำหนัก" },
  { value: "muscle_gain", label: "เพิ่มกล้ามเนื้อ" },
];

export const WORKOUT_LEVEL_OPTIONS: { value: WorkoutLevel; label: string }[] = [
  { value: "beginner", label: "เริ่มต้น" },
  { value: "intermediate", label: "ปานกลาง" },
  { value: "advanced", label: "ขั้นสูง" },
];

export type WorkoutPlanInput = {
  goal: WorkoutGoal;
  daysPerWeek: number;
  level: WorkoutLevel;
  equipment: string;
};

export type WorkoutExercise = {
  name: string;
  sets?: string;
  minutes?: number;
  note?: string;
  sourceKey?: string;
};
export type WorkoutDay = { day: string; focus?: string; exercises: WorkoutExercise[] };
export type WorkoutPlan = { days: WorkoutDay[]; note?: string };

function readExercise(e: Json): WorkoutExercise {
  return {
    name: pick<string>(e, ["name", "exerciseName", "exercise", "title"], "-"),
    sets: String(pick(e, ["sets", "reps", "setsReps", "detail"], "") || ""),
    minutes: num(pick(e, ["minutes", "duration", "durationMinutes"], 0)),
    note: pick<string>(e, ["note", "tips", "description"], ""),
    sourceKey: pick<string>(e, ["sourceKey", "key", "id"], ""),
  };
}

export async function apiWorkoutPlan(input: WorkoutPlanInput): Promise<WorkoutPlan> {
  const data = await apiFetch("/api/workout/plan", { method: "POST", body: input });
  const p = pick<Json>(data, ["plan", "data", "result"], data);
  const rawDays = pick<Json[]>(p, ["days", "schedule", "items"], []);
  return {
    days: (Array.isArray(rawDays) ? rawDays : []).map((d, i) => {
      const list = pick<Json[]>(d, ["exercises", "items", "workouts"], []);
      return {
        day: String(pick(d, ["day", "label", "title", "date"], `วันที่ ${i + 1}`)),
        focus: pick<string>(d, ["focus", "target", "type"], ""),
        exercises: (Array.isArray(list) ? list : []).map(readExercise),
      };
    }),
    note: pick<string>(p, ["note", "advice", "summary"], ""),
  };
}

export type WorkoutLogInput = {
  exerciseName: string;
  minutes: number;
  weightKg?: number;
  sourceKey?: string;
};

export async function apiWorkoutLog(input: WorkoutLogInput) {
  return apiFetch("/api/workout/log", { method: "POST", body: input });
}

export async function apiWorkoutTodayBurn(): Promise<number> {
  const data = await apiFetch("/api/workout/today-burn");
  const b = pick<Json>(data, ["data", "result"], data);
  return num(pick(b, ["burn", "kcal", "burned", "totalKcal", "calories"], 0));
}

export type WorkoutHistoryItem = {
  id: string;
  name: string;
  minutes: number;
  kcal: number;
  date: string;
};

export async function apiWorkoutHistory(): Promise<WorkoutHistoryItem[]> {
  const data = await apiFetch("/api/workout/history");
  const list = pick<Json[]>(data, ["history", "items", "logs", "data"], []);
  return (Array.isArray(list) ? list : []).map((h) => ({
    id: String(pick(h, ["id", "_id"], Math.random().toString(36).slice(2))),
    name: pick<string>(h, ["exerciseName", "name", "exercise"], "-"),
    minutes: num(pick(h, ["minutes", "duration"], 0)),
    kcal: num(pick(h, ["kcal", "calories", "burn", "burned"], 0)),
    date: String(pick(h, ["date", "createdAt", "created_at"], "")).slice(0, 16).replace("T", " "),
  }));
}

/* ----------------------------- GPS Route ----------------------------- */

export type GeoPoint = { lat: number; lng: number };

export async function apiRouteStart(): Promise<string> {
  const data = await apiFetch("/api/route/start", { method: "POST", body: {} });
  const r = pick<Json>(data, ["route", "data"], data);
  return String(pick(r, ["routeId", "id", "_id"], pick(data, ["routeId", "id"], "")));
}

export type RouteResult = { distanceKm: number; kcal: number; durationSeconds: number };

export async function apiRouteStop(input: {
  routeId: string;
  path: GeoPoint[];
  durationSeconds: number;
}): Promise<RouteResult> {
  const data = await apiFetch("/api/route/stop", { method: "POST", body: input });
  const r = pick<Json>(data, ["route", "result", "data"], data);
  return {
    distanceKm: num(pick(r, ["distanceKm", "distance", "km"], 0)),
    kcal: num(pick(r, ["kcal", "calories", "burned"], 0)),
    durationSeconds: num(pick(r, ["durationSeconds", "duration"], input.durationSeconds)),
  };
}

export type RouteHistoryItem = {
  id: string;
  distanceKm: number;
  kcal: number;
  durationSeconds: number;
  date: string;
};

export async function apiRouteHistory(): Promise<RouteHistoryItem[]> {
  const data = await apiFetch("/api/route/history");
  const list = pick<Json[]>(data, ["routes", "history", "items", "data"], []);
  return (Array.isArray(list) ? list : []).map((r) => ({
    id: String(pick(r, ["id", "routeId", "_id"], Math.random().toString(36).slice(2))),
    distanceKm: num(pick(r, ["distanceKm", "distance", "km"], 0)),
    kcal: num(pick(r, ["kcal", "calories", "burned"], 0)),
    durationSeconds: num(pick(r, ["durationSeconds", "duration"], 0)),
    date: String(pick(r, ["date", "createdAt", "created_at", "endedAt"], ""))
      .slice(0, 16)
      .replace("T", " "),
  }));
}

/* ----------------------------- Assistant ----------------------------- */

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; time?: string };

function readChat(raw: Json, i = 0): ChatMessage {
  const role = String(pick(raw, ["role", "from", "sender"], "assistant"));
  return {
    id: String(pick(raw, ["id", "_id"], `m${i}-${Math.random().toString(36).slice(2)}`)),
    role: role === "user" ? "user" : "assistant",
    text: pick<string>(raw, ["text", "message", "content", "reply", "answer"], ""),
    time: String(pick(raw, ["createdAt", "created_at", "time"], "")).slice(11, 16),
  };
}

export async function apiAssistantHistory(): Promise<ChatMessage[]> {
  const data = await apiFetch("/api/assistant/history");
  const list = pick<Json[]>(data, ["history", "messages", "items", "data"], []);
  return (Array.isArray(list) ? list : []).map(readChat);
}

export async function apiAssistantChat(message: string): Promise<ChatMessage> {
  const data = await apiFetch("/api/assistant/chat", { method: "POST", body: { message } });
  const r = pick<Json>(data, ["message", "data", "result"], data);
  const text =
    pick<string>(r, ["reply", "text", "answer", "content", "message"], "") ||
    pick<string>(data, ["reply", "answer"], "");
  return { id: Math.random().toString(36).slice(2), role: "assistant", text };
}

/* ----------------------------- Barcode ----------------------------- */

export async function apiBarcode(code: string): Promise<NutritionResult> {
  const data = await apiFetch(`/api/barcode/${encodeURIComponent(code)}`);
  const raw = pick<Json>(data, ["product", "food", "data", "result"], data);
  const rawItems = pick<Json[]>(raw, ["items", "ingredients"], []);
  return {
    name: pick<string>(raw, ["name", "product_name", "title", "brand"], "สินค้า"),
    kcal: num(pick(raw, ["kcal", "calories", "energy"], 0)),
    protein: num(pick(raw, ["protein", "protein_g"], 0)),
    carb: num(pick(raw, ["carb", "carbs", "carbohydrate"], 0)),
    fat: num(pick(raw, ["fat", "fat_g"], 0)),
    tips: pick<string>(raw, ["tips", "note", "serving", "quantity"], ""),
    items: (Array.isArray(rawItems) ? rawItems : []).map((it) => ({
      label: pick<string>(it, ["label", "name"], "-"),
      grams: num(pick(it, ["grams", "amount"], 0)),
      kcal: num(pick(it, ["kcal", "calories"], 0)),
    })),
  };
}

/* ----------------------------- Music ----------------------------- */

export type Track = {
  id: string;
  url: string;
  title: string;
  type: "youtube" | "audio";
  ytId?: string;
};

function readTrack(raw: Json): Track {
  const type = String(pick(raw, ["type", "kind"], "audio"));
  return {
    id: String(pick(raw, ["id", "_id"], Math.random().toString(36).slice(2))),
    url: pick<string>(raw, ["url", "src", "link"], ""),
    title: pick<string>(raw, ["title", "name"], "ไม่มีชื่อ"),
    type: type === "youtube" || type === "yt" ? "youtube" : "audio",
    ytId: pick<string>(raw, ["ytId", "youtubeId", "videoId"], ""),
  };
}

export function parseYouTubeId(url: string): string {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? "";
}

export async function apiMusicLibrary(): Promise<Track[]> {
  const data = await apiFetch("/api/music/library");
  const list = pick<Json[]>(data, ["library", "tracks", "items", "data"], []);
  return (Array.isArray(list) ? list : []).map(readTrack);
}

export async function apiMusicAdd(input: {
  url: string;
  title: string;
  type: "youtube" | "audio";
  ytId?: string;
}): Promise<Track | null> {
  const data = await apiFetch("/api/music/library", { method: "POST", body: input });
  const t = pick<Json | null>(data, ["track", "item", "data"], null);
  return t ? readTrack(t) : null;
}

export async function apiMusicDelete(id: string) {
  return apiFetch(`/api/music/library/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type PlayHistoryItem = { id: string; title: string; playedAt: string };

export async function apiMusicHistory(): Promise<PlayHistoryItem[]> {
  const data = await apiFetch("/api/music/history");
  const list = pick<Json[]>(data, ["history", "items", "data"], []);
  return (Array.isArray(list) ? list : []).map((h) => ({
    id: String(pick(h, ["id", "_id", "trackId"], Math.random().toString(36).slice(2))),
    title: pick<string>(h, ["title", "name"], "-"),
    playedAt: String(pick(h, ["playedAt", "createdAt", "created_at", "date"], ""))
      .slice(0, 16)
      .replace("T", " "),
  }));
}

export async function apiMusicPlayed(trackId: string) {
  return apiFetch("/api/music/played", { method: "POST", body: { trackId, id: trackId } });
}

/* ----------------------------- Check-in / Streak ----------------------------- */

export type CheckinStatus = {
  streak: number;
  lastDate: string | null;
  freezeAvailable: number;
  alreadyCheckedInToday: boolean;
  greeting: string;
};

export async function apiCheckinToday(): Promise<CheckinStatus> {
  const data = await apiFetch("/api/checkin/today");
  return {
    streak: num(pick(data, ["streak"], 0)),
    lastDate: pick<string | null>(data, ["lastDate"], null),
    freezeAvailable: num(pick(data, ["freezeAvailable"], 2), 2),
    alreadyCheckedInToday: Boolean(pick(data, ["alreadyCheckedInToday"], false)),
    greeting: pick<string>(data, ["greeting"], ""),
  };
}

export type CheckinResult = CheckinStatus & { usedFreeze: boolean };

export async function apiCheckin(): Promise<CheckinResult> {
  const data = await apiFetch("/api/checkin", { method: "POST" });
  return {
    streak: num(pick(data, ["streak"], 0)),
    lastDate: null,
    freezeAvailable: num(pick(data, ["freezeAvailable"], 2), 2),
    alreadyCheckedInToday: Boolean(pick(data, ["alreadyCheckedInToday"], false)),
    usedFreeze: Boolean(pick(data, ["usedFreeze"], false)),
    greeting: pick<string>(data, ["greeting"], ""),
  };
}

/* ----------------------------- Gallery ----------------------------- */

export type GalleryItem = { id: string; foodName: string; calories: number; photoUrl: string; date: string };

export async function apiGalleryUpload(imageBase64: string, mimeType = "image/jpeg"): Promise<string> {
  const data = await apiFetch("/api/gallery/upload", { method: "POST", body: { imageBase64, mimeType } });
  return pick<string>(data, ["url"], "");
}

export async function apiGallery(): Promise<GalleryItem[]> {
  const data = await apiFetch("/api/gallery");
  const list = pick<Json[]>(data, ["items", "data"], []);
  return (Array.isArray(list) ? list : []).map((it) => ({
    id: String(pick(it, ["id", "_id"], Math.random().toString(36).slice(2))),
    foodName: pick<string>(it, ["food_name", "foodName", "name"], "-"),
    calories: num(pick(it, ["calories", "kcal"], 0)),
    photoUrl: pick<string>(it, ["photo_url", "photoUrl"], ""),
    date: String(pick(it, ["created_at", "createdAt"], "")).slice(0, 16).replace("T", " "),
  }));
}
