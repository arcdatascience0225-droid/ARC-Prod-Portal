import { apiClient } from "./client";
import type {
  Dashboard, StudentPortalProfile, StudentProfileUpdate, Certificate, CertificateCreate,
  SyllabusItem, Lecture, Assignment, AssignmentSubmissionCreate, AssignmentSubmission,
  PracticeQuestion, DailyChallenge, AssessmentAttempt, AnswerSubmit, AssessmentResult,
  AssessmentHistoryItem, CodingQuestion, CodeRunRequest, CodeRunResult,
  CodeSubmitRequest, CodeSubmitResult, AvailableAssessment,
} from "../types";

const BASE = "/api/v1/student";

export const dashboardApi = {
  get: () => apiClient.get<Dashboard>(`${BASE}/dashboard`).then((r) => r.data),
};

export const profileApi = {
  get: () => apiClient.get<StudentPortalProfile>(`${BASE}/profile`).then((r) => r.data),
  update: (data: StudentProfileUpdate) =>
    apiClient.put<StudentPortalProfile>(`${BASE}/profile`, data).then((r) => r.data),
  listCertificates: () =>
    apiClient.get<Certificate[]>(`${BASE}/profile/certificates`).then((r) => r.data),
  addCertificate: (data: CertificateCreate) =>
    apiClient.post<Certificate>(`${BASE}/profile/certificates`, data).then((r) => r.data),
  updateCertificate: (id: string, data: CertificateCreate) =>
    apiClient.put<Certificate>(`${BASE}/profile/certificates/${id}`, data).then((r) => r.data),
  deleteCertificate: (id: string) =>
    apiClient.delete(`${BASE}/profile/certificates/${id}`),
};

export const learningApi = {
  getSyllabus: () => apiClient.get<SyllabusItem[]>(`${BASE}/learning/syllabus`).then((r) => r.data),
  updateSyllabusStatus: (id: string, status: string) =>
    apiClient
      .patch<SyllabusItem>(`${BASE}/learning/syllabus/${id}/status`, null, { params: { status } })
      .then((r) => r.data),
  listLectures: (syllabusItemId?: string) =>
    apiClient
      .get<Lecture[]>(`${BASE}/learning/lectures`, { params: { syllabusItemId } })
      .then((r) => r.data),
  listAssignments: () => apiClient.get<Assignment[]>(`${BASE}/learning/assignments`).then((r) => r.data),
  submitAssignment: (data: AssignmentSubmissionCreate) =>
    apiClient
      .post<AssignmentSubmission>(`${BASE}/learning/assignments/submit`, data)
      .then((r) => r.data),
  listPracticeQuestions: (topic?: string, difficulty?: string) =>
    apiClient
      .get<PracticeQuestion[]>(`${BASE}/learning/practice-questions`, { params: { topic, difficulty } })
      .then((r) => r.data),
  getDailyChallenge: () =>
    apiClient.get<DailyChallenge>(`${BASE}/learning/daily-challenge`).then((r) => r.data),
  submitDailyChallenge: (challengeId: string, answerText: string) =>
    apiClient
      .post(`${BASE}/learning/daily-challenge/${challengeId}/submit`, { answerText })
      .then((r) => r.data),
};

export const assessmentApi = {
  available: () => apiClient.get<AvailableAssessment[]>(`${BASE}/assessments/available`).then(r => r.data),
  start: (assessmentId: string) =>
    apiClient
      .post<AssessmentAttempt>(`${BASE}/assessments/${assessmentId}/start`)
      .then((r) => r.data),
  saveAnswer: (assessmentId: string, answer: AnswerSubmit) =>
    apiClient.post(`${BASE}/assessments/${assessmentId}/answer`, answer),
  submit: (resultId: string, answers: AnswerSubmit[]) =>
    apiClient
      .post<AssessmentResult>(`${BASE}/assessments/submit`, { resultId, answers })
      .then((r) => r.data),
  history: () =>
    apiClient.get<AssessmentHistoryItem[]>(`${BASE}/assessments/history`).then((r) => r.data),
  historyBatches: () =>
    apiClient.get<{ id: string; name: string }[]>(`${BASE}/assessments/history/batches`).then((r) => r.data),
};

export const codingApi = {
  list: () =>
    apiClient.get<{ id: string; questionText: string; language: string; marks: number }[]>(`${BASE}/coding`).then((r) => r.data),
  get: (codingQuestionId: string) =>
    apiClient.get<CodingQuestion>(`${BASE}/coding/${codingQuestionId}`).then((r) => r.data),
  run: (data: CodeRunRequest) =>
    apiClient.post<CodeRunResult>(`${BASE}/coding/run`, data).then((r) => r.data),
  submit: (data: CodeSubmitRequest) =>
    apiClient.post<CodeSubmitResult>(`${BASE}/coding/submit`, data).then((r) => r.data),
};
