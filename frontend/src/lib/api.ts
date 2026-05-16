import axios, { type AxiosResponse } from "axios";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "http://localhost:8000/api/";

// Backend origin (e.g., http://localhost:8000) — used to resolve relative media URLs.
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${BACKEND_ORIGIN}${url}`;
  return `${BACKEND_ORIGIN}/${url}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

const getStorage = () => (typeof window !== "undefined" ? window.localStorage : null);

api.interceptors.request.use((config) => {
  const storage = getStorage();
  const token = storage?.getItem("access_token");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const storage = getStorage();
    if (
      error.response?.status === 401 &&
      storage &&
      !original?._retry &&
      storage.getItem("refresh_token")
    ) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = axios
            .post(`${API_BASE_URL}auth/token/refresh/`, {
              refresh: storage.getItem("refresh_token"),
            })
            .then((res) => {
              const access = res.data.access as string;
              storage.setItem("access_token", access);
              return access;
            })
            .catch(() => {
              storage.removeItem("access_token");
              storage.removeItem("refresh_token");
              return null;
            })
            .finally(() => {
              const p = refreshing;
              refreshing = null;
              return p;
            });
        }
        const newToken = await refreshing;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        // fallthrough
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Backend envelope: { data, message, status } — unwrap to the payload.
 * Also handles older shapes where the response is the raw payload.
 */
export function unwrap<T = any>(res: AxiosResponse<any>): T {
  const body = res.data;
  if (body && typeof body === "object" && "data" in body) return body.data as T;
  return body as T;
}

/**
 * Unwraps a list endpoint that returns either:
 *   { data: { count, results: [...] } }     ← new backend (teachers, sessions, etc.)
 *   { data: [...] }                           ← simple list (bookings, reviews)
 *   [...]                                      ← raw array fallback
 */
export function unwrapList<T = any>(res: AxiosResponse<any>): T[] {
  const data = unwrap<any>(res);
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.results)) return data.results as T[];
  return [];
}

/**
 * Normalize a backend TeacherProfile (nested user) into the flat shape the UI components expect.
 * Backend returns: { id, user: {id, full_name, profile_photo, ...}, bio, teaching_mode, years_experience,
 *                   hourly_rate, subjects, languages, city, average_rating, total_reviews, ...verification }
 * Frontend expects: { id, full_name, avatar, mode, experience, rating, reviews_count, verified, ... }
 */
export interface BackendTeacher {
  id: number;
  user?: { id: number; full_name?: string; email?: string; profile_photo?: string | null };
  bio?: string;
  gender?: string;
  teaching_mode?: string;
  years_experience?: number;
  hourly_rate?: string | number;
  languages?: string[];
  subjects?: string[];
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  verification_status?: string;
  is_featured?: boolean;
  average_rating?: number;
  total_reviews?: number;
  distance_km?: number;
  reviews?: any[];
}

export interface NormalizedTeacher {
  id: number | string;
  full_name: string;
  avatar?: string;
  bio?: string;
  subjects: string[];
  languages: string[];
  city?: string;
  mode: "online" | "in-person" | "both";
  hourly_rate: number;
  experience: number;
  rating: number;
  reviews_count: number;
  verified: boolean;
  gender?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  distance_km?: number;
  reviews?: any[];
}

const MODE_MAP: Record<string, NormalizedTeacher["mode"]> = {
  online: "online",
  inperson: "in-person",
  "in-person": "in-person",
  both: "both",
};

export function normalizeTeacher(t: BackendTeacher | any): NormalizedTeacher {
  if (!t) return t;
  // Already flat shape (e.g., sample data) — leave as-is.
  if (!t.user && t.full_name) {
    return {
      ...t,
      mode: MODE_MAP[t.mode ?? t.teaching_mode ?? "online"] ?? "online",
      subjects: t.subjects ?? [],
      languages: t.languages ?? [],
      hourly_rate: Number(t.hourly_rate ?? 0),
      experience: Number(t.experience ?? t.years_experience ?? 0),
      rating: Number(t.rating ?? t.average_rating ?? 0),
      reviews_count: Number(t.reviews_count ?? t.total_reviews ?? 0),
      verified: t.verified ?? t.verification_status === "verified",
    };
  }
  const user = t.user ?? {};
  const lat = t.latitude ?? undefined;
  const lng = t.longitude ?? undefined;
  return {
    id: t.id,
    full_name: user.full_name ?? "Teacher",
    avatar: resolveMediaUrl(user.profile_photo),
    bio: t.bio ?? "",
    subjects: t.subjects ?? [],
    languages: t.languages ?? [],
    city: t.city,
    mode: MODE_MAP[t.teaching_mode ?? "online"] ?? "online",
    hourly_rate: Number(t.hourly_rate ?? 0),
    experience: Number(t.years_experience ?? 0),
    rating: Number(t.average_rating ?? 0),
    reviews_count: Number(t.total_reviews ?? 0),
    verified: t.verification_status === "verified",
    gender: t.gender,
    latitude: lat,
    longitude: lng,
    lat,
    lng,
    distance_km: t.distance_km,
    reviews: t.reviews,
  };
}

export function normalizeTeachers(list: any[]): NormalizedTeacher[] {
  return (list ?? []).map(normalizeTeacher);
}

export default api;
