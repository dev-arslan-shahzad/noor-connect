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
  setUser: (u: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("auth/me/")
      .then((res) => setUser(normalizeUser(res.data?.data ?? res.data)))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("auth/login/", { email, password });
    const data = res.data?.data ?? res.data;
    if (data.access) localStorage.setItem("access_token", data.access);
    if (data.refresh) localStorage.setItem("refresh_token", data.refresh);
    const rawMe =
      data.user ??
      (await api.get("auth/me/")).data?.data ??
      (await api.get("auth/me/")).data;
    const me = normalizeUser(rawMe);
    setUser(me);
    return me as AuthUser;
  }, []);

  const logout = useCallback(() => {
    const refresh = localStorage.getItem("refresh_token");
    api.post("auth/logout/", { refresh }).catch(() => {});
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
