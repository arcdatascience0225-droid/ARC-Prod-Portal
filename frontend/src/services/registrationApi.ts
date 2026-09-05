import { api } from "./api";
import { Batch, Course, StudentProfile } from "../types";

export const registrationApi = {
  registerByStaff: (payload: Record<string, unknown>) =>
    api.post<StudentProfile>("/api/v1/registration/students/staff", payload),

  createInvite: (payload: { email?: string; courseId?: string; batchId?: string; expiresInHours?: number }) =>
    api.post<{ token: string; inviteLink: string; expiresAt: string }>("/api/v1/registration/invites", payload),

  validateInvite: (token: string) => api.get(`/api/v1/registration/invites/${token}/validate`),

  registerViaInvite: (payload: Record<string, unknown>) =>
    api.post<StudentProfile>("/api/v1/registration/students/self", payload),

  bulkUpload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/api/v1/registration/students/bulk-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  uploadDocument: (userId: string, documentType: string, file: File, consent: boolean) => {
    const formData = new FormData();
    formData.append("document_type", documentType);
    formData.append("consent", String(consent));
    formData.append("file", file);
    return api.post(`/api/v1/registration/students/${userId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  duplicateCheck: (name: string, email: string, phone?: string) =>
    api.get("/api/v1/registration/duplicate-check", { params: { name, email, phone } }),

  listCourses: () => api.get<Course[]>("/api/v1/registration/courses"),

  createCourse: (name: string, code: string) => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("code", code);
    return api.post<Course>("/api/v1/registration/courses", formData);
  },

  listBatches: (courseId?: string) => api.get<Batch[]>("/api/v1/registration/batches", { params: { course_id: courseId } }),

  createBatch: (name: string, courseId: string) => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("course_id", courseId);
    return api.post<Batch>("/api/v1/registration/batches", formData);
  },
};
