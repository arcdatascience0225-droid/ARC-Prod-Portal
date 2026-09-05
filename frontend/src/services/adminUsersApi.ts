import { api } from "./api";
import { SignInLogItem, UserListItem } from "../types";

export const adminApi = {
  listUsers: (params: { skip?: number; limit?: number; role?: string; search?: string }) =>
    api.get<{ total: number; items: UserListItem[] }>("/api/v1/admin/users", { params }),

  changeRole: (userId: string, role: string) =>
    api.patch<UserListItem>(`/api/v1/admin/users/${userId}/role`, { role }),

  setAccess: (userId: string, isActive: boolean) =>
    api.patch<UserListItem>(`/api/v1/admin/users/${userId}/access`, { isActive }),

  signInLogs: (params: { skip?: number; limit?: number; user_id?: string }) =>
    api.get<{ total: number; items: SignInLogItem[] }>("/api/v1/admin/sign-in-logs", { params }),

  listBatches: () =>
    api.get<{ id: string; name: string }[]>("/api/v1/registration/batches"),

  enrollInBatch: (batchId: string, userId: string) =>
    api.post(`/api/v1/admin/batches/${batchId}/enroll/${userId}`),
};
