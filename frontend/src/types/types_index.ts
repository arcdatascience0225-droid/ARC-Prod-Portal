// ============ Foundation / Auth (Phase 1) ============
export type Role =
  | "super_admin"
  | "admin"
  | "faculty"
  | "trainer"
  | "hr"
  | "placement_coordinator"
  | "counsellor"
  | "manager"
  | "student"
  | "guest";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  isActive: boolean;
  permissions?: string[] | null;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
}

export interface Batch {
  id: string;
  name: string;
  courseId: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  courseId?: string | null;
  batchId?: string | null;
  registrationSource: string;
  photoConsentGiven: boolean;
  isDuplicateSuspect: boolean;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  batchName?: string | null;
}

export interface SignInLogItem {
  id: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: string;
  createdAt: string;
}

// ============ Student Portal (Phase 2) ============
// NOTE: StudentProfile renamed to StudentPortalProfile to avoid a name
// clash with the Foundation module's registration-time StudentProfile.
export interface Notification {
  id: string;
  title: string;
  message?: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface UpcomingAssessment {
  id: string;
  title: string;
  type: string;
  duration: number;
  startsInMinutes?: number;
}

export interface Dashboard {
  welcomeName: string;
  progressPercent: number;
  attendancePercent: number;
  upcomingAssessments: UpcomingAssessment[];
  recentNotifications: Notification[];
}

export interface StudentPortalProfile {
  id: string;
  userId: string;
  phone?: string;
  bio?: string;
  branch?: string;
  batchYear?: string;
  skills: string[];
  resumeUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
  courseName?: string;
  batchName?: string;
  facultyName?: string;
  courseProgress?: number;
  averagePercentile?: number;
}

export type StudentProfileUpdate = Partial<Omit<StudentPortalProfile, "id" | "userId">>;

export interface Certificate {
  id: string;
  title: string;
  issuer?: string;
  issueDate?: string;
  certificateUrl?: string;
}

export type CertificateCreate = Omit<Certificate, "id">;

export interface SyllabusItem {
  id: string;
  title: string;
  description?: string;
  module?: string;
  orderIndex: number;
  status: "pending" | "in_progress" | "completed";
}

export interface Lecture {
  id: string;
  title: string;
  videoUrl?: string;
  notesUrl?: string;
  durationMinutes?: number;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  maxMarks: number;
  mySubmissionStatus?: string;
}

export interface AssignmentSubmissionCreate {
  assignmentId: string;
  submissionType: "document" | "archive" | "notebook" | "repo_link";
  fileUrl?: string;
  repoLink?: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  submissionType: string;
  fileUrl?: string;
  repoLink?: string;
  status: string;
  facultyFeedback?: string;
  marksObtained?: number;
  submittedAt: string;
}

export interface PracticeQuestion {
  id: string;
  topic?: string;
  questionText: string;
  type: string;
  difficulty: string;
  data?: Record<string, unknown>;
}

export interface DailyChallenge {
  id: string;
  challengeDate: string;
  question: PracticeQuestion;
  alreadyAttempted: boolean;
}

export interface QuestionForAttempt {
  id: string;
  questionText: string;
  type: string;
  /** MCQ choices only — the server strips the correct answer before sending. */
  options?: string[] | null;
  marks: number;
  /** Coding questions only: visible (non-hidden) test cases so the student
   * knows the exact I/O contract before writing code. */
  sampleTestCases?: { input?: string; expectedOutput?: string }[] | null;
}

export interface AvailableAssessment {
  id: string;
  title: string;
  description?: string;
  type: string;
  duration: number;
  questionCount: number;
}

export interface AssessmentAttempt {
  resultId: string;
  assessmentId: string;
  title: string;
  duration: number;
  startedAt: string;
  questions: QuestionForAttempt[];
  maxViolations?: number;
}

export interface AnswerSubmit {
  questionId: string;
  answerText?: string;
  selectedOption?: string;
}

export interface AssessmentResult {
  resultId: string;
  assessmentId: string;
  score: number;
  maxScore: number;
  status: string;
  percentile?: number;
  rank?: number;
  aiFeedback?: string;
  submittedAt?: string;
}

export interface AssessmentHistoryItem {
  resultId: string;
  assessmentTitle: string;
  type: string;
  score: number;
  maxScore?: number;
  status: string;
  percentile?: number;
  rank?: number;
  submittedAt?: string;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface CodingQuestion {
  id: string;
  questionId: string;
  questionText: string;
  starterCode?: string;
  language: string;
  marks: number;
  sampleTestCases: TestCase[];
}

export interface CodeRunRequest {
  codingQuestionId: string;
  code: string;
  language: string;
  customInput?: string;
}

export interface CodeRunResult {
  stdout?: string;
  stderr?: string;
  status: string;
  time?: string;
  memory?: number;
}

export interface CodeSubmitRequest {
  codingQuestionId: string;
  code: string;
  language: string;
}

export interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  isHidden: boolean;
  actualOutput?: string;
  expectedOutput?: string;
}

export interface CodeSubmitResult {
  submissionId: string;
  status: string;
  score: number;
  totalTestCases: number;
  passedTestCases: number;
  testCaseResults: TestCaseResult[];
  aiReview?: string;
}

// ============ Faculty / Trainer Portal (Phase 3) ============
// NOTE: Batch renamed to FacultyBatch to avoid a name clash with the
// Foundation module's Batch type.
export interface FacultyBatch {
  id: string;
  name: string;
  course?: string;
  facultyId: string;
  trainerId?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  studentCount: number;
}

export interface StudentInBatch {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export type AttendanceStatus = "present" | "absent" | "late";

export interface AttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
}

export interface AttendanceRecord {
  id: string;
  batchId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  method: "manual" | "face_recognition";
  markedBy: string;
  createdAt: string;
}

export type QuestionType = "mcq" | "coding" | "sql" | "descriptive";

export interface Question {
  id?: string;
  questionText: string;
  type: QuestionType;
  marks: number;
  tags?: string[];
  data?: Record<string, unknown>;
  createdBy?: string;
  createdAt?: string;
}

export interface Assessment {
  id: string;
  title: string;
  description?: string;
  type: string;
  questionIds: string[];
  duration: number;
  createdBy: string;
  createdAt: string;
  questionCount: number;
  batchIds?: string[];
  maxViolations?: number;
}

export interface StudentPerformanceRow {
  studentId: string;
  studentName: string;
  assessmentsTaken: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  totalScore: number;
}

export interface BatchAnalytics {
  batchId: string;
  batchName: string;
  totalStudents: number;
  averageScore: number;
  topPerformers: LeaderboardEntry[];
  weakStudents: LeaderboardEntry[];
  leaderboard: LeaderboardEntry[];
}

export type InterviewMode = "text" | "audio" | "video";
export type InterviewStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface MockInterview {
  id: string;
  studentId: string;
  scheduledBy: string;
  batchId?: string;
  scheduledAt: string;
  mode: InterviewMode;
  status: InterviewStatus;
  recordingUrl?: string;
}

export interface QnAEntry {
  questionText: string;
  answerText?: string;
  sequence: string;
}

export interface MockInterviewEvaluation {
  id: string;
  mockInterviewId: string;
  confidenceScore?: number;
  communicationScore?: number;
  technicalScore?: number;
  overallScore?: number;
  feedbackText?: string;
  improvementSuggestions?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  facultyId: string;
  createdAt: string;
  batchIds?: string[];
  /** How many users received a notification row for this broadcast. */
  recipientCount?: number;
  notificationId?: string | null;
}

export interface ChatMessage {
  id: string;
  /** Sender - kept as `userId` for backward compatibility. */
  userId: string;
  senderId: string;
  facultyId?: string | null;
  studentId?: string | null;
  sentByStudent: boolean;
  message: string;
  response?: string;
  createdAt: string;
}

// ============ Admin Portal + Analytics + Notifications + AI Assistant (Phase 5) ============
export interface UserOut {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  batchName?: string | null;
  hasCustomPermissions?: boolean;
}

export interface UserListResponse {
  total: number;
  items: UserOut[];
}

export interface CourseOut {
  id: string;
  name: string;
  code: string;
  description?: string;
  duration_weeks: number;
  created_at: string;
}

export interface BatchOut {
  id: string;
  course_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  status: string;
  facultyName?: string | null;
}

export interface PaymentOut {
  id: string;
  user_id: string;
  batch_id?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  created_at: string;
}

export interface AuditLogOut {
  id: string;
  user_id?: string;
  action: string;
  module: string;
  entity_type?: string;
  entity_id?: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AIUsageSummary {
  module: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
}

export interface NotificationOut {
  id: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  status: string;
  created_at: string;
}

export interface MyNotification {
  recipientId: string;
  notificationId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface StudentAnalytics {
  userId: string;
  assessmentsTaken: number;
  averageScore: number;
  codingSubmissions: number;
  codingSuccessRate: number;
  careerReadinessScore: number;
  strengths: string[];
  weaknesses: string[];
  trend: { date: string | null; score: number }[];
}

export interface PlacementAnalytics {
  totalStudents: number;
  placedStudents: number;
  placementRate: number;
  avgOffersPerStudent: number;
  topHiringCompanies: { company: string; hires: number }[];
}

export interface AIRevenueAnalytics {
  totalAiCost: number;
  totalTokens: number;
  totalRevenue: number;
  byModule: { module: string; tokens: number; cost: number }[];
}
