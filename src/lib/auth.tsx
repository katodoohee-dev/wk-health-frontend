import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authLogin, authLogout, authMe, authRegister } from "@/lib/auth-api";
import { getToken, setToken, type ApiUser } from "@/lib/api";

type AuthState = {
  ready: boolean;
  token: string | null;
  user: ApiUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: ApiUser | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

function normalizeUser(user: Awaited<ReturnType<typeof authMe>>): ApiUser | null {
  if (!user) return null;
  return {
    ...user,
    name: String(user.name ?? user.displayName ?? user.display_name ?? ""),
    email: String(user.email ?? ""),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) { setReady(true); return; }
    setTokenState(t);
    authMe()
      .then((u) => setUser(normalizeUser(u)))
      .catch(() => { setToken(null); setTokenState(null); setUser(null); })
      .finally(() => setReady(true));
  }, []);

  const apply = useCallback((t: string, u: Awaited<ReturnType<typeof authMe>>) => {
    setToken(t);
    setTokenState(t);
    setUser(normalizeUser(u));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: t, user: u } = await authLogin(email, password);
    if (!t) throw new Error("เซิร์ฟเวอร์ไม่ได้ส่ง session token");
    apply(t, u);
  }, [apply]);

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const { token: t, user: u } = await authRegister(input);
    if (!t) throw new Error("เซิร์ฟเวอร์ไม่ได้ส่ง session token");
    apply(t, u);
  }, [apply]);

  const logout = useCallback(async () => {
    try { await authLogout(); } finally {
      setToken(null);
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(() => ({
    ready,
    token,
    user,
    isAuthenticated: Boolean(token),
    login,
    register,
    logout,
    setUser,
  }), [ready, token, user, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องอยู่ภายใน AuthProvider");
  return ctx;
}
