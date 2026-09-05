import { apiClient } from "./fetchClient";
import type { NotificationOut, MyNotification } from "../types";

export const notificationApi = {
  create: (data: {
    title: string; message: string; type: string; channel: string;
    targetRoles: string[]; targetUsers: string[]; targetBatches?: string[];
  }) => apiClient.post<NotificationOut>(`/notifications`, data),
  // `batchIds` reaches every enrolled student of those batches. Broadcast is
  // open to all staff, not just Super Admin/Admin.
  broadcast: (data: { title: string; message: string; roles: string[]; batchIds?: string[]; channel?: string }) =>
    apiClient.post<NotificationOut>(`/notifications/broadcast`, data),
  mine: (unreadOnly = false) =>
    apiClient.get<MyNotification[]>(`/notifications/mine${unreadOnly ? "?unread_only=true" : ""}`),
  markRead: (recipientId: string) => apiClient.put(`/notifications/mine/${recipientId}/read`),
  listAll: () => apiClient.get<NotificationOut[]>(`/notifications`),
};
