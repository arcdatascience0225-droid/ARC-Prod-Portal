"""Canonical catalog of every nav item in the app, mirrored from
frontend/src/components/AppShell.tsx. Used for:
  - the Super Admin's per-user permission checkbox picker
  - resolving default access for a role when a user has no custom
    `permissions` override (permissions is null)

Each entry's `path` matches the `to` route path used in the frontend nav
config exactly - that's the shared vocabulary between backend and frontend
for "what can this user see".
"""

PERMISSIONS_CATALOG = [
    # (path, label, group, default_roles)
    {"path": "/dashboard", "label": "Dashboard", "group": "Overview",
     "defaultRoles": ["super_admin", "admin", "hr", "placement_coordinator", "counsellor", "manager", "guest"]},

    {"path": "/student/dashboard", "label": "Dashboard", "group": "Learning",
     "defaultRoles": ["student"]},
    {"path": "/student/profile", "label": "My Profile", "group": "Learning",
     "defaultRoles": ["student"]},
    {"path": "/student/learning", "label": "Learning", "group": "Learning",
     "defaultRoles": ["student"]},
    {"path": "/student/assignments", "label": "Assignments", "group": "Learning",
     "defaultRoles": ["student"]},
    {"path": "/student/coding-lab", "label": "Coding Lab", "group": "Learning",
     "defaultRoles": ["student"]},
    {"path": "/student/assessments/history", "label": "Assessment History", "group": "Learning",
     "defaultRoles": ["student"]},
    {"path": "/student/mock-interview", "label": "Mock Interview", "group": "Learning",
     "defaultRoles": ["student"]},

    {"path": "/student/jobs/recommended", "label": "Recommended Jobs", "group": "Jobs & Career",
     "defaultRoles": ["student"]},
    {"path": "/student/jobs/applications", "label": "My Applications", "group": "Jobs & Career",
     "defaultRoles": ["student"]},
    {"path": "/student/jobs/offers", "label": "My Offers", "group": "Jobs & Career",
     "defaultRoles": ["student"]},
    {"path": "/chatbot", "label": "AI Career Assistant", "group": "Jobs & Career",
     "defaultRoles": ["student"]},
    {"path": "/chatbot/resume-builder", "label": "Resume Builder", "group": "Jobs & Career",
     "defaultRoles": ["student"]},
    {"path": "/chatbot/career-guidance", "label": "Career Guidance", "group": "Jobs & Career",
     "defaultRoles": ["student"]},

    {"path": "/registration/staff", "label": "Register Student", "group": "Registration",
     "defaultRoles": ["super_admin", "faculty", "trainer", "hr", "placement_coordinator", "manager"]},
    {"path": "/registration/invite", "label": "Invite Links", "group": "Registration",
     "defaultRoles": ["super_admin", "faculty", "trainer", "hr", "placement_coordinator", "manager"]},

    {"path": "/faculty/dashboard", "label": "Faculty Dashboard", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/announcements", "label": "Announcements", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/attendance", "label": "Attendance", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin", "manager"]},
    {"path": "/faculty/question-bank", "label": "Question Bank", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/assessments", "label": "My Assessments", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/assessments/new", "label": "Create Assessment", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/evaluate", "label": "Evaluate Assignments", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/performance", "label": "Student Performance", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/mock-interviews", "label": "Mock Interviews", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/reports", "label": "Reports", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},
    {"path": "/faculty/chat", "label": "Chat with Students", "group": "Faculty Portal",
     "defaultRoles": ["faculty", "trainer", "super_admin"]},

    {"path": "/hr/companies", "label": "Companies", "group": "HR / Placement",
     "defaultRoles": ["hr", "placement_coordinator", "super_admin"]},
    {"path": "/hr/jobs", "label": "Jobs", "group": "HR / Placement",
     "defaultRoles": ["hr", "placement_coordinator", "super_admin"]},
    {"path": "/hr/candidate-match", "label": "Candidate Matching", "group": "HR / Placement",
     "defaultRoles": ["hr", "placement_coordinator", "super_admin"]},
    {"path": "/hr/offers", "label": "Offers", "group": "HR / Placement",
     "defaultRoles": ["hr", "placement_coordinator", "super_admin"]},
    {"path": "/hr/analytics", "label": "Placement Analytics", "group": "HR / Placement",
     "defaultRoles": ["hr", "placement_coordinator", "super_admin"]},
    {"path": "/interview/schedule", "label": "Schedule Interview", "group": "HR / Placement",
     "defaultRoles": ["hr", "placement_coordinator", "faculty", "trainer", "super_admin"]},
    {"path": "/interview/conduct", "label": "Conduct Interview", "group": "HR / Placement",
     "defaultRoles": ["hr", "placement_coordinator", "faculty", "trainer", "super_admin"]},

    {"path": "/counsellor/leads", "label": "Leads", "group": "Counsellor",
     "defaultRoles": ["counsellor", "super_admin"]},

    {"path": "/admin/user-management", "label": "Manage Users", "group": "Administration",
     "defaultRoles": ["super_admin"]},
    {"path": "/admin/sign-in-logs", "label": "Sign-In Activity", "group": "Administration",
     "defaultRoles": ["super_admin"]},
    {"path": "/admin/courses-batches", "label": "Courses & Batches", "group": "Administration",
     "defaultRoles": ["super_admin", "admin"]},
    {"path": "/admin/payments", "label": "Payments", "group": "Administration",
     "defaultRoles": ["super_admin", "admin", "manager"]},
    {"path": "/admin/settings", "label": "Platform Settings", "group": "Administration",
     "defaultRoles": ["super_admin"]},
    {"path": "/admin/audit-log", "label": "Audit Log", "group": "Administration",
     "defaultRoles": ["super_admin"]},
    {"path": "/admin/ai-usage", "label": "AI Usage Dashboard", "group": "Administration",
     "defaultRoles": ["super_admin"]},
    {"path": "/admin/notifications", "label": "Notifications", "group": "Administration",
     "defaultRoles": ["super_admin", "admin"]},
    {"path": "/admin/students", "label": "Students", "group": "Administration",
     "defaultRoles": ["super_admin", "admin", "hr"]},
    {"path": "/admin/faculty", "label": "Faculty", "group": "Administration",
     "defaultRoles": ["super_admin", "admin"]},
    {"path": "/admin/fees", "label": "Fees", "group": "Administration",
     "defaultRoles": ["super_admin", "admin", "manager"]},

    {"path": "/analytics", "label": "Analytics", "group": "Analytics",
     "defaultRoles": ["super_admin", "admin", "faculty", "trainer", "hr", "placement_coordinator"]},
]


def default_permissions_for_role(role: str) -> list[str]:
    return [item["path"] for item in PERMISSIONS_CATALOG if role in item["defaultRoles"]]
