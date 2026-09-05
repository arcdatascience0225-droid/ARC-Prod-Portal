export interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  hrContactName?: string;
  hrContactEmail?: string;
  hrContactPhone?: string;
  address?: string;
  logoUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  companyId: string;
  companyName?: string;
  title: string;
  description: string;
  requiredSkills: string[];
  minExperienceYears: number;
  minScorePercent: number;
  jobType: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  openings: number;
  status: "open" | "closed" | "on_hold";
  applicationDeadline?: string;
  postedBy: string;
  createdAt: string;
  updatedAt: string;
  targetBatchIds?: string[];
}

export interface RecommendedJob extends Job {
  matchScore: number;
  matchReasoning: string;
  skillsMatched: string[];
  skillsMissing: string[];
}

export interface CandidateMatch {
  studentId: string;
  studentName: string;
  studentEmail: string;
  matchScore: number;
  matchReasoning: string;
  avgAssessmentScore?: number;
  skillsMatched: string[];
  skillsMissing: string[];
}

export interface MatchRunResponse {
  jobId: string;
  totalCandidatesEvaluated: number;
  matches: CandidateMatch[];
}

export type ApplicationStatus =
  | "applied"
  | "shortlisted"
  | "interview"
  | "offer"
  | "rejected"
  | "placed"
  | "withdrawn";

export interface Application {
  id: string;
  jobId: string;
  jobTitle?: string;
  companyName?: string;
  studentId: string;
  studentName?: string;
  matchScore?: number;
  matchReasoning?: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  roundName: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: string;
  meetingLink?: string;
  interviewerId?: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  recordingUrl?: string;
  transcript?: string;
  aiScore?: number;
  aiAnalysis?: {
    strengths: string[];
    weaknesses: string[];
    summary: string;
  };
  interviewerFeedback?: string;
  interviewerRating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  applicationId: string;
  designation: string;
  salaryOffered: number;
  location?: string;
  joiningDate?: string;
  offerLetterUrl?: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  issuedAt: string;
  respondedAt?: string;
}

export interface PlacementAnalytics {
  totalStudents: number;
  totalApplications: number;
  totalInterviews: number;
  totalOffers: number;
  totalPlaced: number;
  placementRatePercent: number;
  avgSalaryOffered?: number;
  highestSalaryOffered?: number;
  companyWiseHires: Record<string, number>;
  statusFunnel: Record<string, number>;
}
