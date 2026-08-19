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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type ApiUser = {
  id?: string | number;
  name?: string;
  email?: string;
  goalKcal?: number;
  goal_kcal?: number;
  weightKg?: number;
  heightCm?: number;
  proteinGoal?: number;
  carbGoal?: number;
  fatGoal?: number;
  streak?: number;
  [k: string]: unknown;
};

export type AuthPayload = { token: string; user: ApiUser | null };

function normalizeUser(u: ApiUser | null): ApiUser | null {
  if (!u || typeof u !== "object") return null;
  return {
    ...u,
    name: pick<string>(u, ["name", "displayName", "display_name"], ""),
    ...(num(pick(u, ["weightKg", "weight_kg"], 0)) ? { weightKg: num(pick(u, ["weightKg", "weight_kg"], 0)) } : {}),
    ...(num(pick(u, ["heightCm", "height_cm"], 0)) ? { heightCm: num(pick(u, ["heightCm", "height_cm"], 0)) } : {}),
    goalKcal: num(pick(u, ["goalKcal", "goal_kcal"], 2000), 2000),
  };
}

function readAuth(data: Json): AuthPayload {
  const token = pick<string>(data, ["token", "accessToken", "access_token"], "");
  const user = normalizeUser(pick<ApiUser | null>(data, ["user", "profile", "data"], null));
  return { token, user };
}

export async function apiLogin(email: string, password: string) {
  return readAuth(await apiFetch("/api/auth/login", { method: "POST", body: { email, password } }));
}

/** Backend expects `displayName`; keep the public UI API as `name`. */
export async function apiRegister(input: { name: string; email: string; password: string }) {
  return readAuth(
    await apiFetch("/api/auth/register", {
      method: "POST",
      body: { email: input.email, password: input.password, displayName: input.name },
    }),
  );
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
  return normalizeUser(pick<ApiUser | null>(data, ["user", "profile", "data"], null));
}

export async function apiUpdateMe(patch: Partial<ApiUser> & { name?: string }): Promise<ApiUser | null> {
  const { name, ...rest } = patch;
  const body: Json = { ...rest };
  if (name !== undefined) body["displayName"] = name;
  await apiFetch("/api/auth/me", { method: "PATCH", body });
  return apiMe();
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
