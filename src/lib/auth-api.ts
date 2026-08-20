import { API_BASE_URL, ApiError, getToken } from "./api";

type Json = Record<string, unknown>;

async function authRequest<T extends Json>(path: string, body?: Json, method = "POST"): Promise<T> {
  try {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data: Json = {};
    try { data = (await response.json()) as Json; } catch {}
    if (!response.ok || data.success === false) {
      const message =
        (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        `เชื่อมต่อระบบบัญชีไม่สำเร็จ (${response.status})`;
      throw new ApiError(message, response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("ไม่สามารถเชื่อมต่อ WK Health Backend ได้ กรุณาลองใหม่อีกครั้ง");
  }
}

export type AuthUser = {
  id?: string | number;
  email?: string;
  name?: string;
  displayName?: string;
  display_name?: string;
  [key: string]: unknown;
};

export type AuthResult = { token: string; user: AuthUser | null };

function readAuth(data: Json): AuthResult {
  return {
    token: String(data.token ?? data.accessToken ?? data.access_token ?? ""),
    user: (data.user ?? data.profile ?? null) as AuthUser | null,
  };
}

export async function authLogin(email: string, password: string): Promise<AuthResult> {
  return readAuth(await authRequest<Json>("/api/auth/login", { email, password }));
}

export async function authRegister(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  return readAuth(await authRequest<Json>("/api/auth/register", {
    email: input.email,
    password: input.password,
    displayName: input.name,
  }));
}

export async function authMe(): Promise<AuthUser | null> {
  const data = await authRequest<Json>("/api/auth/me", undefined, "GET");
  return (data.user ?? data.profile ?? data.data ?? null) as AuthUser | null;
}

export async function authLogout(): Promise<void> {
  await authRequest<Json>("/api/auth/logout", undefined, "POST");
}
