const DEFAULT_BACKEND = "https://https-sites-google-com-sbp-ac-th.onrender.com";

export function backendUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (envUrl || DEFAULT_BACKEND).replace(/\/$/, "");
}

export type AuthUser = { id: string; name?: string; email?: string };
type FriendRecord = { id?: string | number; name?: string; streak?: number; avatar?: string };

async function backendFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${backendUrl()}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error(`BACKEND_${res.status}`);
  return data as T;
}

export async function authenticateRequest(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new Error("UNAUTHORIZED");
  const raw = await backendFetch<{ user?: AuthUser; profile?: AuthUser; data?: AuthUser } | AuthUser>("/api/auth/me", token);
  const user = (raw as any)?.user || (raw as any)?.profile || (raw as any)?.data || raw;
  if (!user?.id) throw new Error("UNAUTHORIZED");
  return { token, user: { id: String(user.id), name: user.name, email: user.email } as AuthUser };
}

export async function getConfirmedFriendIds(token: string) {
  const raw = await backendFetch<FriendRecord[] | { friends?: FriendRecord[]; data?: FriendRecord[] }>("/friends", token);
  const list = Array.isArray(raw) ? raw : (raw as any)?.friends || (raw as any)?.data || [];
  return Array.from(new Set(list.map((friend) => String(friend.id)).filter(Boolean)));
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function mapError(error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code === "UNAUTHORIZED") return json({ success: false, error: "ไม่ได้รับอนุญาต" }, 401);
  if (code === "BACKEND_401" || code === "BACKEND_403") return json({ success: false, error: "เซสชันหมดอายุหรือไม่มีสิทธิ์" }, 401);
  return json({ success: false, error: "บริการตำแหน่งยังไม่พร้อมใช้งาน" }, 503);
}
