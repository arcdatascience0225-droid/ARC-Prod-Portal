"""Creates one ready-to-login account per role, plus a sample course,
batch, company and job so every portal (Student/Faculty/HR/Admin) has
something to look at instead of being empty.

Usage:
    python seed_data.py

Safe to re-run - skips anything that already exists (matched by email /
course code / company name).

All seeded users share the same password: Password123!
"""
from datetime import date

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.enums import RoleEnum
from app.models.course import Course, Batch, BatchStudent
from app.models.placement import Company, Job

PASSWORD = "Password123!"

SEED_USERS = [
    ("Super Admin", "superadmin@platform.com", RoleEnum.SUPER_ADMIN),
    ("Admin User", "admin@platform.com", RoleEnum.ADMIN),
    ("Faculty User", "faculty@platform.com", RoleEnum.FACULTY),
    ("Trainer User", "trainer@platform.com", RoleEnum.TRAINER),
    ("HR User", "hr@platform.com", RoleEnum.HR),
    ("Placement Coordinator", "placement@platform.com", RoleEnum.PLACEMENT_COORDINATOR),
    ("Sample Student", "student@platform.com", RoleEnum.STUDENT),
]


def get_or_create_user(db, name, email, role) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        print(f"  exists: {email} ({role.value})")
        return user
    user = User(name=name, email=email, password_hash=hash_password(PASSWORD), role=role, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  created: {email} ({role.value})")
    return user


def main():
    db = SessionLocal()
    try:
        print("Seeding users (all passwords: Password123!)...")
        users = {}
        for name, email, role in SEED_USERS:
            users[role] = get_or_create_user(db, name, email, role)

        print("\nSeeding course + batch...")
        course = db.query(Course).filter(Course.code == "FSD-101").first()
        if not course:
            course = Course(
                name="Full Stack Development",
                code="FSD-101",
                description="End-to-end web development: frontend, backend, databases, deployment.",
                duration_weeks=16,
                created_by=users[RoleEnum.ADMIN].id,
            )
            db.add(course)
            db.commit()
            db.refresh(course)
            print(f"  created course: {course.name} ({course.code})")
        else:
            print(f"  exists: {course.name} ({course.code})")

        batch = db.query(Batch).filter(Batch.name == "FSD-2026-Jan").first()
        if not batch:
            batch = Batch(
                name="FSD-2026-Jan",
                course_id=course.id,
                start_date=date(2026, 1, 15),
                end_date=date(2026, 5, 15),
                faculty_id=users[RoleEnum.FACULTY].id,
                trainer_id=users[RoleEnum.TRAINER].id,
                status="active",
            )
            db.add(batch)
            db.commit()
            db.refresh(batch)
            print(f"  created batch: {batch.name}")
        else:
            print(f"  exists: {batch.name}")

        # Enroll the sample student (and any real students already registered)
        for role_key in (RoleEnum.STUDENT,):
            student = users[role_key]
            already = db.query(BatchStudent).filter(
                BatchStudent.batch_id == batch.id, BatchStudent.user_id == student.id
            ).first()
            if not already:
                db.add(BatchStudent(batch_id=batch.id, user_id=student.id))
                db.commit()
                print(f"  enrolled {student.email} in {batch.name}")

        # Also enroll every other existing student in the DB (e.g. the
        # account you already registered through the UI) so it shows up
        # in faculty/admin views too.
        other_students = db.query(User).filter(User.role == RoleEnum.STUDENT, User.email != "student@platform.com").all()
        for s in other_students:
            already = db.query(BatchStudent).filter(
                BatchStudent.batch_id == batch.id, BatchStudent.user_id == s.id
            ).first()
            if not already:
                db.add(BatchStudent(batch_id=batch.id, user_id=s.id))
                db.commit()
                print(f"  enrolled existing student {s.email} in {batch.name}")

        print("\nSeeding company + job...")
        company = db.query(Company).filter(Company.name == "Acme Tech Solutions").first()
        if not company:
            company = Company(
                name="Acme Tech Solutions",
                industry="Software",
                website="https://example.com",
                hr_contact_name="Jordan Lee",
                hr_contact_email="jordan@acme.example.com",
                created_by=users[RoleEnum.HR].id,
            )
            db.add(company)
            db.commit()
            db.refresh(company)
            print(f"  created company: {company.name}")
        else:
            print(f"  exists: {company.name}")

        job = db.query(Job).filter(Job.title == "Junior Full Stack Developer", Job.company_id == company.id).first()
        if not job:
            job = Job(
                company_id=company.id,
                title="Junior Full Stack Developer",
                description="Entry-level role building features across our React + FastAPI stack.",
                required_skills=["python", "react", "sql"],
                min_experience_years=0,
                min_score_percent=0,
                job_type="full_time",
                location="Remote",
                openings=3,
                status="open",
                posted_by=users[RoleEnum.HR].id,
            )
            db.add(job)
            db.commit()
            print(f"  created job: {job.title} at {company.name}")
        else:
            print(f"  exists: {job.title}")

        print("\nDone. Login with any of these (password: Password123!):")
        for name, email, role in SEED_USERS:
            print(f"  {email:30s} -> {role.value}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
