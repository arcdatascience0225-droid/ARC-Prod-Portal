import { apiClient } from "./fetchClient";
import type { UserOut, UserListResponse, CourseOut, BatchOut, PaymentOut, AuditLogOut, AIUsageSummary } from "../types";

export const adminApi = {
  // Backend returns a {total, items} envelope; this client's callers want a
  // plain array, so unwrap here rather than diverging the contract again.
  listUsers: (role?: string) =>
    apiClient
      .get<UserListResponse>(`/admin/users${role ? `?role=${encodeURIComponent(role)}` : ""}`)
      .then((r) => r.items),
  // Admin-only path for creating staff (or student) accounts directly with a
  // chosen role. Backend restricts this to Super Admin. Public /auth/register
  // always creates Student accounts regardless of what's sent here.
  createUser: (data: { name: string; email: string; password: string; role: string }) =>
    apiClient.post<UserOut>(`/admin/users`, data),
  updateUserRole: (userId: string, role: string) => apiClient.put<UserOut>(`/admin/users/${userId}/role`, { role }),
  setUserAccess: (userId: string, isActive: boolean) =>
    apiClient.patch<UserOut>(`/admin/users/${userId}/access`, { isActive }),
  deleteUser: (userId: string) => apiClient.delete<void>(`/admin/users/${userId}`),

  listCourses: () => apiClient.get<CourseOut[]>(`/admin/courses`),
  createCourse: (data: { name: string; code: string; description?: string; durationWeeks: number }) =>
    apiClient.post<CourseOut>(`/admin/courses`, data),
  deleteCourse: (id: string) => apiClient.delete<void>(`/admin/courses/${id}`),

  listBatches: (courseId?: string) => apiClient.get<BatchOut[]>(`/admin/batches${courseId ? `?course_id=${courseId}` : ""}`),
  createBatch: (data: { courseId: string; name: string; startDate?: string; endDate?: string; facultyId?: string; trainerId?: string }) =>
    apiClient.post<BatchOut>(`/admin/batches`, data),
  enrollStudent: (batchId: string, userId: string) => apiClient.post(`/admin/batches/${batchId}/enroll/${userId}`),

  permissionsCatalog: () => apiClient.get<{ path: string; label: string; group: string; defaultRoles: string[] }[]>(`/admin/permissions-catalog`),
  getUserPermissions: (userId: string) => apiClient.get<{ userId: string; isCustom: boolean; permissions: string[] }>(`/admin/users/${userId}/permissions`),
  setUserPermissions: (userId: string, permissions: string[] | null) =>
    apiClient.put(`/admin/users/${userId}/permissions`, { permissions }),

  listPayments: (status?: string) => apiClient.get<PaymentOut[]>(`/admin/payments${status ? `?status=${status}` : ""}`),
  createPayment: (data: { userId: string; batchId?: string; amount: number; currency?: string; paymentMethod?: string }) =>
    apiClient.post<PaymentOut>(`/admin/payments`, data),
  updatePaymentStatus: (id: string, status: string) => apiClient.put<PaymentOut>(`/admin/payments/${id}/status`, { status }),

  listSettings: () => apiClient.get(`/admin/settings`),
  upsertSetting: (key: string, value: Record<string, unknown>) => apiClient.put(`/admin/settings`, { key, value }),

  listAuditLogs: (module?: string) => apiClient.get<AuditLogOut[]>(`/admin/audit-logs${module ? `?module=${module}` : ""}`),
  aiUsageDashboard: () => apiClient.get<AIUsageSummary[]>(`/admin/ai-usage`),
};
