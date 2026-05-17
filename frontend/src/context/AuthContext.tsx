import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import api, { resolveMediaUrl } from "@/lib/api";

export type UserRole = "student" | "teacher" | "admin";

export interface AuthUser {
  id: string | number;
  email: string;
  full_name?: string;
  role: UserRole;
  avatar?: string;
  profile_photo?: string;
  phone?: string;
  city?: string;
}

function normalizeUser(u: any): AuthUser | null {
  if (!u) return null;
  const photo = resolveMediaUrl(u.profile_photo ?? u.avatar);
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    avatar: photo,
    profile_photo: photo,
    phone: u.phone,
    city: u.city,
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  /** Accepts a raw backend user object or a normalized AuthUser (or null to clear). */
  setUser: (u: any) => void;
  /** Atomically save tokens + user after register/login and stop loading. */
  setSession: (params: { access?: string; refresh?: string; user: any }) => AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserRaw] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Accepts either a raw backend user (will be normalized) or an already-normalized one.
  // Always clears the loading flag so callers don't need to.
  const setUser = useCallback((u: any) => {
    setUserRaw(u ? normalizeUser(u) : null);
    setLoading(false);
  }, []);

  const setSession = useCallback<AuthContextValue["setSession"]>(({ access, refresh, user: raw }) => {
    if (typeof window !== "undefined") {
      if (access) localStorage.setItem("access_token", access);
      if (refresh) localStorage.setItem("refresh_token", refresh);
    }
    const normalized = normalizeUser(raw);
    setUserRaw(normalized);
    setLoading(false);
    return normalized;
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("auth/me/")
      .then((res) => setUserRaw(normalizeUser(res.data?.data ?? res.data)))
      .catch(() => setUserRaw(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("auth/login/", { email, password });
    const data = res.data?.data ?? res.data;
    const rawMe =
      data.user ??
      (await api.get("auth/me/")).data?.data ??
      (await api.get("auth/me/")).data;
    const me = setSession({ access: data.access, refresh: data.refresh, user: rawMe });
    return me as AuthUser;
  }, [setSession]);

  const logout = useCallback(() => {
    const refresh = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
    api.post("auth/logout/", { refresh }).catch(() => {});
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    setUserRaw(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
