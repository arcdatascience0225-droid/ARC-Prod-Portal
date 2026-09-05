import { api } from "./api";
import { TokenResponse, User } from "../types";

export const authApi = {
  register: (payload: { name: string; email: string; password: string; phone?: string }) =>
    api.post<User>("/api/v1/auth/register", payload),

  login: (payload: { email: string; password: string }) =>
    api.post<TokenResponse>("/api/v1/auth/login", payload),

  me: () => api.get<User>("/api/v1/auth/me"),

  logout: () => api.post("/api/v1/auth/logout"),

  forgotPassword: (email: string) => api.post("/api/v1/auth/forgot-password", { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post("/api/v1/auth/reset-password", { token, newPassword }),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.post("/api/v1/auth/change-password", { oldPassword, newPassword }),
};
