import axios from "axios";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "http://localhost:8000/api/";

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

export default api;
