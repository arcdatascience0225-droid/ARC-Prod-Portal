import {
  Company,
  Job,
  RecommendedJob,
  MatchRunResponse,
  Application,
  Interview,
  Offer,
  PlacementAnalytics,
} from "../types/placement";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("accessToken") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ---------------- HR: Companies ----------------
export const hrApi = {
  listCompanies: (search = "") =>
    request<Company[]>(`/api/v1/hr/companies?search=${encodeURIComponent(search)}`),
  createCompany: (data: Partial<Company>) =>
    request<Company>(`/api/v1/hr/companies`, { method: "POST", body: JSON.stringify(data) }),
  updateCompany: (id: string, data: Partial<Company>) =>
    request<Company>(`/api/v1/hr/companies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCompany: (id: string) =>
    request<void>(`/api/v1/hr/companies/${id}`, { method: "DELETE" }),

  // Jobs
  listJobs: (params: { status?: string; companyId?: string } = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<Job[]>(`/api/v1/hr/jobs${qs ? `?${qs}` : ""}`);
  },
  createJob: (data: Partial<Job>) =>
    request<Job>(`/api/v1/hr/jobs`, { method: "POST", body: JSON.stringify(data) }),
  updateJob: (id: string, data: Partial<Job>) =>
    request<Job>(`/api/v1/hr/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  closeJob: (id: string) => request<Job>(`/api/v1/hr/jobs/${id}/close`, { method: "POST" }),
  deleteJob: (id: string) => request<void>(`/api/v1/hr/jobs/${id}`, { method: "DELETE" }),

  // Matching
  matchCandidates: (jobId: string) =>
    request<MatchRunResponse>(`/api/v1/hr/jobs/${jobId}/match-candidates`, { method: "POST" }),

  // Applications
  listAllApplications: () => request<Application[]>(`/api/v1/hr/applications`),
  listJobApplications: (jobId: string, status?: string) =>
    request<Application[]>(
      `/api/v1/hr/jobs/${jobId}/applications${status ? `?status=${status}` : ""}`
    ),
  updateApplicationStatus: (id: string, status: string) =>
    request<Application>(`/api/v1/hr/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Offers
  createOffer: (data: {
    applicationId: string;
    designation: string;
    salaryOffered: number;
    location?: string;
    joiningDate?: string;
  }) => request<Offer>(`/api/v1/hr/offers`, { method: "POST", body: JSON.stringify(data) }),
  listOffers: () => request<Offer[]>(`/api/v1/hr/offers`),

  // Candidate view
  viewCandidateResults: (studentId: string) =>
    request<any>(`/api/v1/hr/candidates/${studentId}/results`),

  // Analytics
  getAnalytics: () => request<PlacementAnalytics>(`/api/v1/hr/analytics`),

  // Export
  exportApplicationsCsvUrl: (jobId?: string) =>
    `${API_BASE}/api/v1/hr/export/applications.csv${jobId ? `?job_id=${jobId}` : ""}`,
};

// ---------------- Interview Portal ----------------
export const interviewApi = {
  schedule: (data: {
    applicationId: string;
    roundName: string;
    scheduledAt: string;
    durationMinutes: number;
    mode: string;
    meetingLink?: string;
    interviewerId?: string;
  }) => request<Interview>(`/api/v1/interviews`, { method: "POST", body: JSON.stringify(data) }),

  get: (id: string) => request<Interview>(`/api/v1/interviews/${id}`),

  listByApplication: (applicationId: string) =>
    request<Interview[]>(`/api/v1/interviews/application/${applicationId}`),

  myUpcoming: () => request<Interview[]>(`/api/v1/interviews/my/upcoming`),

  myAssigned: () => request<Interview[]>(`/api/v1/interviews/my/assigned`),

  update: (id: string, data: Partial<Interview>) =>
    request<Interview>(`/api/v1/interviews/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  submitFeedback: (id: string, feedback: string, rating: number) =>
    request<Interview>(`/api/v1/interviews/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ feedback, rating }),
    }),

  analyze: (id: string, transcript: string) =>
    request<Interview>(`/api/v1/interviews/${id}/analyze`, {
      method: "POST",
      body: JSON.stringify({ transcript }),
    }),
};

// ---------------- Student: Jobs & Placement ----------------
export const studentJobsApi = {
  recommended: (limit = 10) =>
    request<RecommendedJob[]>(`/api/v1/student/jobs/recommended?limit=${limit}`),

  apply: (jobId: string) =>
    request<Application>(`/api/v1/student/jobs/${jobId}/apply`, { method: "POST" }),

  myApplications: () => request<Application[]>(`/api/v1/student/jobs/applications`),

  withdraw: (applicationId: string) =>
    request<Application>(`/api/v1/student/jobs/applications/${applicationId}/withdraw`, {
      method: "POST",
    }),

  myOffers: () => request<Offer[]>(`/api/v1/student/jobs/offers`),

  respondToOffer: (offerId: string, status: "accepted" | "declined") =>
    request<Offer>(`/api/v1/student/jobs/offers/${offerId}/respond?status=${status}`, {
      method: "POST",
    }),
};
