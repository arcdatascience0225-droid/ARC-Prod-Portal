import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppShellLayout } from "./components/AppShell";

// Auth (public)
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { SelfRegisterInvitePage } from "./pages/registration/SelfRegisterInvitePage";

// Foundation
import { DashboardPage } from "./pages/DashboardPage";
import { StaffRegisterStudentPage } from "./pages/registration/StaffRegisterStudentPage";
import { InviteLinkPage } from "./pages/registration/InviteLinkPage";
import { BulkUploadPage } from "./pages/registration/BulkUploadPage";
import { ManageUsersPage } from "./pages/admin/ManageUsersPage";
import { SignInLogsPage } from "./pages/admin/SignInLogsPage";

// Student Portal
import StudentDashboard from "./pages/student/StudentDashboard";
import Profile from "./pages/student/Profile";
import Learning from "./pages/student/Learning";
import Assignments from "./pages/student/Assignments";
import CodingLab from "./pages/student/CodingLab";
import AssessmentAttempt from "./pages/student/AssessmentAttempt";
import AssessmentHistory from "./pages/student/AssessmentHistory";
import MockInterviewTakePage from "./pages/student/MockInterviewTake";
import RecommendedJobsPage from "./pages/student/jobs/RecommendedJobsPage";
import ApplicationTrackerPage from "./pages/student/jobs/ApplicationTrackerPage";
import StudentOffersPage from "./pages/student/jobs/OffersPage";

// Faculty / Trainer Portal
import FacultyDashboard from "./pages/faculty/FacultyDashboard";
import BatchDetailPage from "./pages/faculty/BatchDetailPage";
import StudentDetailPage from "./pages/faculty/StudentDetailPage";
import AnnouncementsPage from "./pages/faculty/Announcements";
import AttendancePage from "./pages/faculty/Attendance";
import ChatPage from "./pages/faculty/Chat";
import CreateAssessmentPage from "./pages/faculty/CreateAssessment";
import MyAssessmentsPage from "./pages/faculty/MyAssessmentsPage";
import EvaluateAssignmentsPage from "./pages/faculty/EvaluateAssignments";
import MockInterviewSchedulePage from "./pages/faculty/MockInterviewSchedule";
import QuestionBankPage from "./pages/faculty/QuestionBank";
import ReportsPage from "./pages/faculty/Reports";
import StudentPerformancePage from "./pages/faculty/StudentPerformance";

// HR / Placement / Interview Portal
import CompaniesPage from "./pages/hr/CompaniesPage";
import OffersPage from "./pages/hr/OffersPage";
import Leads from "./pages/counsellor/Leads";
import FacultyDirectory from "./pages/admin/FacultyDirectory";
import StudentsDirectory from "./pages/admin/StudentsDirectory";
import FeesPage from "./pages/admin/FeesPage";
import HrAnalyticsPage from "./pages/hr/AnalyticsPage";
import ScheduleInterviewPage from "./pages/interview/ScheduleInterviewPage";
import ConductInterviewListPage from "./pages/interview/ConductInterviewListPage";
import { JobsPageRoute, CandidateMatchPageRoute, ConductInterviewPageRoute } from "./pages/RouteAdapters";

// Admin Portal
import AdminDashboard from "./pages/admin/AdminDashboard";
import CourseBatchManagement from "./pages/admin/CourseBatchManagement";
import PaymentManagement from "./pages/admin/PaymentManagement";
import PlatformSettings from "./pages/admin/PlatformSettings";
import AuditLog from "./pages/admin/AuditLog";
import AIUsageDashboard from "./pages/admin/AIUsageDashboard";
import NotificationManagement from "./pages/admin/NotificationManagement";
import UserManagement from "./pages/admin/UserManagement";

// Analytics
import AnalyticsDashboard from "./pages/analytics/AnalyticsDashboard";

// AI Assistant / Chatbot
import ChatbotWidget from "./pages/chatbot/ChatbotWidget";
import ResumeBuilder from "./pages/chatbot/ResumeBuilder";
import CareerGuidance from "./pages/chatbot/CareerGuidance";

// Fallback
import { NotFoundPage } from "./pages/NotFoundPage";

const STAFF_ROLES = ["super_admin", "admin", "faculty", "trainer", "hr", "placement_coordinator"] as const;
const ADMIN_ROLES = ["super_admin", "admin"] as const;
const FACULTY_ROLES = ["faculty", "trainer", "admin", "super_admin"] as const;
const HR_ROLES = ["hr", "placement_coordinator", "admin", "super_admin"] as const;
const INTERVIEW_ROLES = ["hr", "placement_coordinator", "faculty", "trainer", "admin", "super_admin"] as const;
const STUDENT_ROLES = ["student"] as const;
const ANALYTICS_ROLES = ["super_admin", "admin", "faculty", "trainer", "hr", "placement_coordinator"] as const;
const COUNSELLOR_ROLES = ["counsellor", "super_admin"] as const;
const MANAGER_ROLES = ["manager", "super_admin"] as const;

function gate(roles: readonly string[], element: React.ReactNode) {
  return <ProtectedRoute allowedRoles={[...roles] as any}>{element}</ProtectedRoute>;
}

const App: React.FC = () => (
  <ThemeProvider>
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        {/* ---------- Public ---------- */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register/invite" element={<SelfRegisterInvitePage />} />

        {/* ---------- Distraction-free exam mode ----------
            Deliberately OUTSIDE the AppShell group: while a test is in
            progress the student must not see the sidebar, dashboard links,
            chatbot or sign-out - only the paper, the timer and the
            navigation controls for the test itself.
            React Router ranks the static "/history" segment above this
            dynamic one, so the history page still resolves inside the shell. */}
        <Route
          path="/student/assessments/:assessmentId"
          element={gate(STUDENT_ROLES, <AssessmentAttempt />)}
        />

        {/* ---------- Everything below shares one AppShell (sidebar/nav) ---------- */}
        <Route
          element={
            <ProtectedRoute>
              <AppShellLayout />
            </ProtectedRoute>
          }
        >
          {/* Foundation */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/registration/staff" element={gate(STAFF_ROLES, <StaffRegisterStudentPage />)} />
          <Route path="/registration/invite" element={gate(STAFF_ROLES, <InviteLinkPage />)} />
          <Route path="/admin/users" element={gate(ADMIN_ROLES, <ManageUsersPage />)} />
          <Route path="/admin/sign-in-logs" element={gate(ADMIN_ROLES, <SignInLogsPage />)} />

          {/* Student Portal */}
          <Route path="/student/dashboard" element={gate(STUDENT_ROLES, <StudentDashboard />)} />
          <Route path="/student/profile" element={gate(STUDENT_ROLES, <Profile />)} />
          <Route path="/student/learning" element={gate(STUDENT_ROLES, <Learning />)} />
          <Route path="/student/assignments" element={gate(STUDENT_ROLES, <Assignments />)} />
          <Route path="/student/coding-lab" element={gate(STUDENT_ROLES, <CodingLab />)} />
          <Route path="/student/coding-lab/:codingQuestionId" element={gate(STUDENT_ROLES, <CodingLab />)} />
          <Route path="/student/assessments/history" element={gate(STUDENT_ROLES, <AssessmentHistory />)} />
          <Route path="/student/mock-interview" element={gate(STUDENT_ROLES, <MockInterviewTakePage />)} />
          <Route path="/student/jobs/recommended" element={gate(STUDENT_ROLES, <RecommendedJobsPage />)} />
          <Route path="/student/jobs/applications" element={gate(STUDENT_ROLES, <ApplicationTrackerPage />)} />
          <Route path="/student/jobs/offers" element={gate(STUDENT_ROLES, <StudentOffersPage />)} />

          {/* Faculty / Trainer Portal */}
          <Route path="/faculty/dashboard" element={gate(FACULTY_ROLES, <FacultyDashboard />)} />
          <Route path="/faculty/batches/:batchId" element={gate(FACULTY_ROLES, <BatchDetailPage />)} />
          <Route path="/faculty/students/:studentId" element={gate(FACULTY_ROLES, <StudentDetailPage />)} />
          <Route path="/faculty/announcements" element={gate(FACULTY_ROLES, <AnnouncementsPage />)} />
          <Route path="/faculty/attendance" element={gate(FACULTY_ROLES, <AttendancePage />)} />
          <Route path="/faculty/chat" element={gate(FACULTY_ROLES, <ChatPage />)} />
          <Route path="/faculty/assessments" element={gate(FACULTY_ROLES, <MyAssessmentsPage />)} />
          <Route path="/faculty/assessments/new" element={gate(FACULTY_ROLES, <CreateAssessmentPage />)} />
          <Route path="/faculty/evaluate" element={gate(FACULTY_ROLES, <EvaluateAssignmentsPage />)} />
          <Route path="/faculty/mock-interviews" element={gate(FACULTY_ROLES, <MockInterviewSchedulePage />)} />
          <Route path="/faculty/question-bank" element={gate(FACULTY_ROLES, <QuestionBankPage />)} />
          <Route path="/faculty/reports" element={gate(FACULTY_ROLES, <ReportsPage />)} />
          <Route path="/faculty/performance" element={gate(FACULTY_ROLES, <StudentPerformancePage />)} />

          {/* HR / Placement / Interview Portal */}
          <Route path="/hr/companies" element={gate(HR_ROLES, <CompaniesPage />)} />
          <Route path="/hr/jobs" element={gate(HR_ROLES, <JobsPageRoute />)} />
          <Route path="/hr/candidate-match" element={gate(HR_ROLES, <JobsPageRoute />)} />
          <Route path="/hr/candidate-match/:jobId" element={gate(HR_ROLES, <CandidateMatchPageRoute />)} />
          <Route path="/hr/offers" element={gate(HR_ROLES, <OffersPage />)} />
          <Route path="/counsellor/leads" element={gate(COUNSELLOR_ROLES, <Leads />)} />
          <Route path="/admin/faculty" element={gate(ADMIN_ROLES, <FacultyDirectory />)} />
          <Route path="/admin/students" element={gate([...ADMIN_ROLES, "hr"], <StudentsDirectory />)} />
          <Route path="/admin/fees" element={gate([...ADMIN_ROLES, "manager"], <FeesPage />)} />
          <Route path="/hr/analytics" element={gate(HR_ROLES, <HrAnalyticsPage />)} />
          <Route path="/interview/schedule" element={gate(INTERVIEW_ROLES, <ScheduleInterviewPage />)} />
          <Route path="/interview/conduct" element={gate(INTERVIEW_ROLES, <ConductInterviewListPage />)} />
          <Route path="/interview/conduct/:interviewId" element={gate(INTERVIEW_ROLES, <ConductInterviewPageRoute />)} />

          {/* Admin Portal */}
          <Route path="/admin/dashboard" element={gate(ADMIN_ROLES, <AdminDashboard />)} />
          <Route path="/admin/user-management" element={gate(ADMIN_ROLES, <UserManagement />)} />
          <Route path="/admin/courses-batches" element={gate(ADMIN_ROLES, <CourseBatchManagement />)} />
          <Route path="/admin/payments" element={gate(ADMIN_ROLES, <PaymentManagement />)} />
          <Route path="/admin/settings" element={gate(ADMIN_ROLES, <PlatformSettings />)} />
          <Route path="/admin/audit-log" element={gate(ADMIN_ROLES, <AuditLog />)} />
          <Route path="/admin/ai-usage" element={gate(ADMIN_ROLES, <AIUsageDashboard />)} />
          <Route path="/admin/notifications" element={gate(ADMIN_ROLES, <NotificationManagement />)} />

          {/* Analytics */}
          <Route path="/analytics" element={gate(ANALYTICS_ROLES, <AnalyticsDashboard />)} />

          {/* AI Assistant / Chatbot (student-facing) */}
          <Route path="/chatbot" element={gate(STUDENT_ROLES, <ChatbotWidget />)} />
          <Route path="/chatbot/resume-builder" element={gate(STUDENT_ROLES, <ResumeBuilder />)} />
          <Route path="/chatbot/career-guidance" element={gate(STUDENT_ROLES, <CareerGuidance />)} />

          {/* Catch-all: any unmatched authenticated URL shows a message instead of a blank page */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Catch-all for unauthenticated/unknown top-level URLs */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
  </ThemeProvider>
);

export default App;
