// Live WK API client.
// Prefer an explicitly configured backend in every environment. If it is not
// configured, use the same-origin /api proxy on Render. This keeps the login
// usable with both the direct backend URL and the Render proxy.
const explicitApiBase = (import.meta.env.VITE_WK_API_URL as string | undefined)?.trim().replace(/\/$/, "");
const legacyApiBase = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_BACKEND_URL as string | undefined)
)?.trim().replace(/\/$/, "");

const configuredApiBase = explicitApiBase || legacyApiBase;
const isLocal = typeof window === "undefined" || /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.host);
export const API_BASE = isLocal
  ? (configuredApiBase || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"))
  : (configuredApiBase || window.location.origin);

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string; code?: string };

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("wk_session_token") ?? localStorage.getItem("wk_token") ?? "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const candidates = Array.from(new Set([
    `${API_BASE}${path}`,
    ...(typeof window !== "undefined" && window.location.origin !== API_BASE && !isLocal ? [`${window.location.origin}${path}`] : []),
  ]));
  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      const headers = new Headers(init.headers);
      headers.set("content-type", "application/json");
      const t = token();
      if (t) headers.set("authorization", `Bearer ${t}`);
      const response = await fetch(url, { ...init, headers });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
        localStorage.removeItem("wk_session_token");
        localStorage.removeItem("wk_token");
        window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
        return { success: false, error: "ต้องเข้าสู่ระบบก่อน", code: "unauthorized" };
      }
      if (!response.ok || body.success === false) {
        // A proxy error can be retried against the configured backend. Never
        // retry real authentication failures (401/403) as another endpoint.
        if ((response.status === 502 || response.status === 503 || response.status === 504) && url !== candidates[candidates.length - 1]) {
          continue;
        }
        return {
          success: false,
          error: String(body.error ?? body.message ?? `Request failed (${response.status})`),
          code: typeof body.code === "string" ? body.code : undefined,
        };
      }
      return { success: true, data: body as T };
    } catch (error) {
      lastError = error;
      if (url !== candidates[candidates.length - 1]) continue;
    }
  }
  console.error("WK API request failed", path, lastError);
  return { success: false, error: "เชื่อมต่อ WK Health backend ไม่สำเร็จ" };
}

function storeToken(token: string) {
  if (!token) return;
  localStorage.setItem("wk_session_token", token);
  localStorage.setItem("wk_token", token);
}

export async function login(email: string, password: string) {
  const result = await request<{ token: string; user: { id: string; email: string; displayName: string | null } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password }) },
  );
  if (result.success) storeToken(result.data.token);
  return result;
}

export async function register(email: string, password: string, displayName: string) {
  const result = await request<{ token: string; user: { id: string; email: string; displayName: string | null } }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password, displayName: displayName.trim() }) },
  );
  if (result.success) storeToken(result.data.token);
  return result;
}

export function logout() {
  localStorage.removeItem("wk_session_token");
  localStorage.removeItem("wk_token");
}

export async function uploadImage(dataUrl: string, mimeType: string) {
  return request<{ url: string }>("/api/gallery/upload", {
    method: "POST",
    body: JSON.stringify({ imageBase64: dataUrl, mimeType }),
  });
}

export async function analyzeFood(dataUrl: string, mimeType: string) {
  return request<{ description: string }>("/api/scan/vision", {
    method: "POST",
    body: JSON.stringify({ imageBase64: dataUrl, mimeType }),
  });
}

export async function calculateNutrition(description: string) {
  return request<{ nutrition: { foodName: string; calories: number; protein: number; carbs: number; fat: number; sodium: number; fiber: number } }>(
    "/api/scan/calc",
    { method: "POST", body: JSON.stringify({ description }) },
  );
}

export async function saveMeal(input: { foodName: string; calories: number; protein: number; carbs: number; fat: number; sodium: number; fiber: number; photoUrl?: string; description?: string }) {
  return request<{ id: number }>("/api/scan/save", {
    method: "POST",
    body: JSON.stringify({ ...input, source: "vision" }),
  });
}

export async function chat(message: string) {
  return request<{ reply: string }>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function assistantHistory() {
  return request<{ messages: { role: string; content: string; created_at: string }[] }>("/api/assistant/history");
}

export function backendUrl(path: string) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
