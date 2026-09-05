HOW TO APPLY THIS BUNDLE

This zip contains ONLY the files that changed or are new — NOT the whole
project. It mirrors the exact folder structure of your project, so:

1. Extract this zip anywhere temporary.
2. Copy the "backend" folder's contents INTO your D:\ai-learning-platform\backend
   folder, overwriting existing files with the same path/name.
   Copy the "frontend" folder's contents INTO your D:\ai-learning-platform\frontend
   folder the same way.
   (In Windows File Explorer: select all, drag into the target folder,
   choose "Replace the files in the destination" when prompted.)
3. Run RUN_THIS_SQL_FIRST.txt's SQL in Supabase's SQL Editor BEFORE deploying.
4. Then:
     cd D:\ai-learning-platform
     git add -A
     git commit -m "Roles/permissions system, Leads, Faculty/Students directories, Manager attendance, Fees, student portal fixes"
     git push
     cd frontend
     npx vercel --prod

WHAT'S IN THIS BATCH
- Student portal fixes: Coding Lab infinite-loading fix (+ question picker),
  backend pre-warm ping (cold-start mitigation), certificate Edit/Delete.
- New roles: Counsellor, Manager.
- Custom per-user permission system: Super Admin can now open "Access" on
  any user in User Management and check/uncheck exactly which pages they
  can see, overriding the role default.
- Admin sidebar restructured: Question Bank, Assessment, Schedule
  Mock/Assignment, AI Usage Dashboard, Manage Users, Chat with Students,
  Placement, Sign-In Activity are now Super Admin only (not Admin).
  Admin gained "Students" and "Faculty" directory pages.
- Counsellor "Leads" page: enquiry form + list + status tracking.
- Admin "Faculty" page: faculty name -> their batches -> click a batch to
  see its students.
- Admin "Students" page: every student with their batch, searchable.
- Manager: new "Faculty Attendance" section at the top of the Attendance
  page (mark faculty/trainer present/late/absent per date).
- Admin/Manager "Fees" page: create a one-time or installment fee
  structure per student, mark installments paid.

HONEST NOTE: this is a lot of new surface area built in one pass. Test
each new page after deploying, and report back anything that doesn't
work — don't assume all of it is bug-free on the first try.
