const API_BASE = (import.meta.env.VITE_WK_API_URL as string | undefined)?.replace(/\/$/, "") ?? "https://wk-health-backend.onrender.com";

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string; code?: string };

function token() { return typeof window === "undefined" ? "" : localStorage.getItem("wk_session_token") ?? ""; }

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(init.headers); headers.set("content-type", "application/json");
    const t = token(); if (t) headers.set("authorization", `Bearer ${t}`);
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      localStorage.removeItem("wk_session_token");
      window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return { success: false, error: "ต้องเข้าสู่ระบบก่อน", code: "unauthorized" };
    }
    if (!response.ok || body.success === false) return { success: false, error: String(body.error ?? `Request failed (${response.status})`), code: typeof body.code === "string" ? body.code : undefined };
    return { success: true, data: body as T };
  } catch { return { success: false, error: "เชื่อมต่อ WK Health backend ไม่สำเร็จ" }; }
}

export async function login(email: string, password: string) { const result = await request<{ token: string; user: { id: string; email: string; displayName: string | null } }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); if (result.success) localStorage.setItem("wk_session_token", result.data.token); return result; }
export async function register(email: string, password: string, displayName: string) { const result = await request<{ token: string; user: { id: string; email: string; displayName: string | null } }>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) }); if (result.success) localStorage.setItem("wk_session_token", result.data.token); return result; }
export function logout() { localStorage.removeItem("wk_session_token"); }
export async function uploadImage(dataUrl: string, mimeType: string) { return request<{ url: string }>("/api/gallery/upload", { method: "POST", body: JSON.stringify({ imageBase64: dataUrl, mimeType }) }); }
export async function analyzeFood(dataUrl: string, mimeType: string) { return request<{ description: string }>("/api/scan/vision", { method: "POST", body: JSON.stringify({ imageBase64: dataUrl, mimeType }) }); }
export async function calculateNutrition(description: string) { return request<{ nutrition: { foodName: string; calories: number; protein: number; carbs: number; fat: number; sodium: number; fiber: number } }>("/api/scan/calc", { method: "POST", body: JSON.stringify({ description }) }); }
export async function saveMeal(input: { foodName: string; calories: number; protein: number; carbs: number; fat: number; sodium: number; fiber: number; photoUrl?: string; description?: string }) { return request<{ id: number }>("/api/scan/save", { method: "POST", body: JSON.stringify({ ...input, source: "vision" }) }); }
export async function chat(message: string) { return request<{ reply: string }>("/api/assistant/chat", { method: "POST", body: JSON.stringify({ message }) }); }
export async function assistantHistory() { return request<{ messages: { role: string; content: string; created_at: string }[] }>("/api/assistant/history"); }
export function backendUrl(path: string) { return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`; }
