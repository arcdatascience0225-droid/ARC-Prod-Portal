import apiClient from "./facultyClient";
import {
  FacultyBatch, StudentInBatch, AttendanceEntry, AttendanceRecord, Question,
  Assessment, StudentPerformanceRow, BatchAnalytics, MockInterview,
  MockInterviewEvaluation, QnAEntry, Announcement, ChatMessage,
} from "../types";

// ---------- Batches ----------
export const createBatch = (payload: Partial<FacultyBatch>) =>
  apiClient.post<FacultyBatch>("/faculty/batches", payload).then((r) => r.data);

export const getMyBatches = () =>
  apiClient.get<FacultyBatch[]>("/faculty/batches").then((r) => r.data);

export const addStudentsToBatch = (batchId: string, studentIds: string[]) =>
  apiClient.post(`/faculty/batches/${batchId}/students`, { studentIds });

export const getBatchStudents = (batchId: string) =>
  apiClient.get<StudentInBatch[]>(`/faculty/batches/${batchId}/students`).then((r) => r.data);

export interface BatchAssignmentProgress {
  assignmentId: string;
  title: string;
  dueDate: string | null;
  maxMarks: number;
  totalStudents: number;
  submittedCount: number;
}

export const getBatchAssignmentsProgress = (batchId: string) =>
  apiClient.get<{ batchId: string; assignments: BatchAssignmentProgress[] }>(`/faculty/batches/${batchId}/assignments-progress`).then((r) => r.data.assignments);

export interface FacultyActivitySummary {
  lecturesTaken: number;
  onlineClasses: number;
  offlineClasses: number;
  assessmentsCreated: number;
  mocksScheduled: number;
}

export const getMySummary = () =>
  apiClient.get<FacultyActivitySummary>("/faculty/my-summary").then((r) => r.data);

export interface BatchSummaryRow {
  batchId: string;
  batchName: string;
  course: string | null;
  startDate: string | null;
  endDate: string | null;
  delayedByDays: number;
  syllabusPercent: number;
  batchTime: string | null;
  studentsCount: number;
  assessmentsGiven: number;
  mocksGiven: number;
}

export const getBatchesSummary = () =>
  apiClient.get<BatchSummaryRow[]>("/faculty/batches-summary").then((r) => r.data);

export interface BatchDetail {
  batchId: string;
  batchName: string;
  course: string | null;
  startDate: string | null;
  endDate: string | null;
  delayedByDays: number;
  syllabusPercent: number;
  batchTime: string | null;
  assessmentsGiven: number;
  studentsCount: number;
  activeStudents: number;
  inactiveStudents: number;
}

export const getBatchDetail = (batchId: string) =>
  apiClient.get<BatchDetail>(`/faculty/batches/${batchId}/detail`).then((r) => r.data);

// ---------- Attendance ----------
export const markAttendance = (batchId: string, date: string, entries: AttendanceEntry[]) =>
  apiClient
    .post<AttendanceRecord[]>("/attendance", { batchId, date, entries, method: "manual" })
    .then((r) => r.data);

export const getBatchAttendance = (batchId: string, forDate: string) =>
  apiClient
    .get<AttendanceRecord[]>(`/attendance/batch/${batchId}`, { params: { for_date: forDate } })
    .then((r) => r.data);

export const triggerFaceRecognitionAttendance = (batchId: string, date: string, imageUrl?: string) =>
  apiClient.post("/attendance/face-recognition-hook", { batchId, date, imageUrl }).then((r) => r.data);

export interface AttendanceReportRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  totalLectures: number;
  missedLectures: number;
  onlineLectures: number;
  offlineLectures: number;
}

export const getAttendanceReport = (params: { batchId?: string; startDate?: string; endDate?: string; studentName?: string }) =>
  apiClient.get<AttendanceReportRow[]>("/attendance/report", {
    params: {
      batch_id: params.batchId || undefined,
      start_date: params.startDate || undefined,
      end_date: params.endDate || undefined,
      student_name: params.studentName || undefined,
    },
  }).then((r) => r.data);

export interface StudentFullDetail {
  studentId: string;
  studentName: string;
  studentEmail: string;
  totalLectures: number;
  onlineLectures: number;
  offlineLectures: number;
  assignmentsSubmitted: number;
  mocksGiven: number;
  rank: number | null;
  score: number | null;
  assignmentsScore: number | null;
  mockScore: number | null;
  batchName: string | null;
  facultyName: string | null;
  jobsApplied: number;
  jobsRejected: number;
  placed: boolean;
}

export const getStudentFullDetail = (studentId: string, batchId?: string) =>
  apiClient.get<StudentFullDetail>(`/attendance/student/${studentId}/full-detail`, {
    params: { batch_id: batchId || undefined },
  }).then((r) => r.data);

// ---------- Question Bank ----------
export const createQuestion = (payload: Question) =>
  apiClient.post<Question>("/question-bank", payload).then((r) => r.data);

export const listQuestionBank = (type?: string, tag?: string) =>
  apiClient.get<Question[]>("/question-bank", { params: { type, tag } }).then((r) => r.data);

export const updateQuestion = (id: string, payload: Partial<Question>) =>
  apiClient.put<Question>(`/question-bank/${id}`, payload).then((r) => r.data);

export const deleteQuestion = (id: string) =>
  apiClient.delete(`/question-bank/${id}`);

export const generateQuestionsWithAI = (payload: {
  topic: string; type: string; difficulty: string; count: number; saveToBank: boolean;
}) => apiClient.post("/question-bank/ai-generate", payload).then((r) => r.data);

// ---------- Assessments ----------
export const createAssessment = (payload: {
  title: string; description?: string; type: string; questionIds: string[];
  duration: number; batchIds?: string[]; maxViolations?: number;
}) => apiClient.post<Assessment>("/assessments", payload).then((r) => r.data);

export const getMyAssessments = () =>
  apiClient.get<Assessment[]>("/assessments").then((r) => r.data);

// Admin/Super Admin: every assessment across all faculty, not just "mine".
export const getAllAssessments = () =>
  apiClient.get<Assessment[]>("/assessments/all").then((r) => r.data);

// ---------- Performance ----------
export const getBatchAnalytics = (batchId: string) =>
  apiClient.get<BatchAnalytics>(`/performance/batch/${batchId}/analytics`).then((r) => r.data);

export const getBatchStudentPerformance = (batchId: string) =>
  apiClient.get<StudentPerformanceRow[]>(`/performance/batch/${batchId}/students`).then((r) => r.data);

export const addAssignmentFeedback = (payload: {
  resultId: string; feedbackText: string; scoreOverride?: number;
}) => apiClient.post("/performance/feedback", payload).then((r) => r.data);

// ---------- Mock Interviews ----------
export const scheduleMockInterview = (payload: {
  studentId: string; batchId?: string; scheduledAt: string; mode: string;
}) => apiClient.post<MockInterview>("/mock-interviews", payload).then((r) => r.data);

export const getMyScheduledInterviews = () =>
  apiClient.get<MockInterview[]>("/mock-interviews/scheduled-by-me").then((r) => r.data);

export const getMyInterviews = () =>
  apiClient.get<MockInterview[]>("/mock-interviews/my-interviews").then((r) => r.data);

export const submitMockInterview = (id: string, responses: QnAEntry[], recordingUrl?: string) =>
  apiClient
    .post<MockInterviewEvaluation>(`/mock-interviews/${id}/submit`, { responses, recordingUrl })
    .then((r) => r.data);

export const getInterviewEvaluation = (id: string) =>
  apiClient.get<MockInterviewEvaluation>(`/mock-interviews/${id}/evaluation`).then((r) => r.data);

export const getMyEvaluation = (id: string) =>
  apiClient.get<MockInterviewEvaluation>(`/mock-interviews/${id}/my-evaluation`).then((r) => r.data);

// ---------- Announcements + Chat ----------
export const broadcastAnnouncement = (payload: {
  title: string; message: string; batchIds: string[]; channel?: string;
}) => apiClient.post<Announcement>("/announcements", payload).then((r) => r.data);

export const getMyAnnouncements = () =>
  apiClient.get<Announcement[]>("/announcements").then((r) => r.data);

export const sendChatMessage = (studentId: string, message: string) =>
  apiClient
    .post<ChatMessage>(`/chat/students/${studentId}/messages`, { studentId, message })
    .then((r) => r.data);

export const getChatThread = (studentId: string) =>
  apiClient.get<ChatMessage[]>(`/chat/students/${studentId}/messages`).then((r) => r.data);

// ---------- Reports ----------
export const downloadBatchReport = async (batchId: string, format: "excel" | "pdf") => {
  const response = await apiClient.get(`/reports/batch/${batchId}/${format}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `batch_${batchId}_report.${format === "excel" ? "xlsx" : "pdf"}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};
