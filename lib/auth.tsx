import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authLogin, authLogout, authMe, authRegister } from "@/lib/auth-api";
import { ApiError, getToken, setToken, type ApiUser } from "@/lib/api";

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

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function restoreSession(): Promise<ApiUser | null> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return normalizeUser(await authMe());
    } catch (error) {
      lastError = error;
      // Only an explicit auth rejection means the stored session is invalid.
      // Network/Render cold-start failures must not log the user out.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        throw error;
      }
      if (attempt < 2) await wait(800 * (attempt + 1));
    }
  }
  if (lastError) throw lastError;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = getToken();
    if (!t) {
      setReady(true);
      return () => { cancelled = true; };
    }

    setTokenState(t);
    restoreSession()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setToken(null);
          setTokenState(null);
          setUser(null);
        }
        // Keep the token on transient/network errors so a sleeping/waking
        // backend does not force the user to sign in again.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => { cancelled = true; };
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
