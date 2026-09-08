import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// ---------------------------------------------------------------------
// Global in-flight-request tracking. A button click that triggers a slow
// (15-20s) request with no visual feedback looks like it silently failed,
// so users click again — this powers a global loading overlay (see
// GlobalLoadingOverlay.tsx) that appears automatically for ANY API call,
// with no per-page/per-button wiring needed.
// ---------------------------------------------------------------------
let activeRequests = 0;
const loadingListeners = new Set<(active: boolean) => void>();

export function subscribeToLoading(listener: (active: boolean) => void) {
  loadingListeners.add(listener);
  return () => { loadingListeners.delete(listener); };
}

function notifyLoading() {
  const active = activeRequests > 0;
  loadingListeners.forEach((l) => l(active));
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  activeRequests += 1;
  notifyLoading();
  return config;
});

function getAccessToken() {
  return localStorage.getItem("accessToken");
}

function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyLoading();
    return response;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyLoading();
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let pendingQueue: Array<() => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry && getRefreshToken()) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push(() => resolve(api(originalRequest)));
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken });
        setTokens(data.accessToken, data.refreshToken);
        pendingQueue.forEach((cb) => cb());
        pendingQueue = [];
        return api(originalRequest);
      } catch (refreshError) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
