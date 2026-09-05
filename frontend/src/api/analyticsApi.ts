import { apiClient } from "./fetchClient";
import type { StudentAnalytics, PlacementAnalytics, AIRevenueAnalytics } from "../types";

export const analyticsApi = {
  studentAnalytics: (userId: string) => apiClient.get<StudentAnalytics>(`/analytics/students/${userId}`),
  batchAnalytics: (batchId: string) => apiClient.get(`/analytics/batches/${batchId}`),
  facultyAnalytics: (facultyId: string) => apiClient.get(`/analytics/faculty/${facultyId}`),
  placementAnalytics: () => apiClient.get<PlacementAnalytics>(`/analytics/placements`),
  courseAttendanceAnalytics: () => apiClient.get(`/analytics/courses-attendance`),
  aiRevenueAnalytics: () => apiClient.get<AIRevenueAnalytics>(`/analytics/ai-revenue`),
  recomputeCareerReadiness: (userId: string) => apiClient.post(`/analytics/students/${userId}/career-readiness`),
};
