# Database Schema — ARC Technologies & Institutions

Auto-generated from the SQLAlchemy models in `backend/app/models/`. This reflects the
current database structure (54 tables) as of this document's generation.

> **Note:** This listing shows column names and types accurately (extracted directly
> from the model source). Primary key / foreign key annotations below are best-effort —
> for the exact constraint on any single column, check that column's line in the
> corresponding `backend/app/models/*.py` file.

## Table of Contents

- [`ai_usage`](#ai_usage)
- [`announcement_batches`](#announcement_batches)
- [`announcements`](#announcements)
- [`applications`](#applications)
- [`assessments`](#assessments)
- [`assignment_feedback`](#assignment_feedback)
- [`assignment_submissions`](#assignment_submissions)
- [`assignments`](#assignments)
- [`attendance`](#attendance)
- [`audit_logs`](#audit_logs)
- [`batch_faculty`](#batch_faculty)
- [`batch_students`](#batch_students)
- [`batches`](#batches)
- [`bulk_upload_jobs`](#bulk_upload_jobs)
- [`career_readiness_scores`](#career_readiness_scores)
- [`chat_history`](#chat_history)
- [`code_reviews`](#code_reviews)
- [`coding_questions`](#coding_questions)
- [`coding_submissions`](#coding_submissions)
- [`companies`](#companies)
- [`courses`](#courses)
- [`daily_challenge_attempts`](#daily_challenge_attempts)
- [`daily_challenges`](#daily_challenges)
- [`documents`](#documents)
- [`fee_installments`](#fee_installments)
- [`fee_structures`](#fee_structures)
- [`interviews`](#interviews)
- [`jobs`](#jobs)
- [`leads`](#leads)
- [`lectures`](#lectures)
- [`mock_interview_evaluation`](#mock_interview_evaluation)
- [`mock_interview_qna`](#mock_interview_qna)
- [`mock_interviews`](#mock_interviews)
- [`notification_recipients`](#notification_recipients)
- [`notifications`](#notifications)
- [`offers`](#offers)
- [`payments`](#payments)
- [`platform_settings`](#platform_settings)
- [`practice_questions`](#practice_questions)
- [`proctor_snapshots`](#proctor_snapshots)
- [`questions`](#questions)
- [`registration_invites`](#registration_invites)
- [`results`](#results)
- [`resumes`](#resumes)
- [`sign_in_logs`](#sign_in_logs)
- [`staff_attendance`](#staff_attendance)
- [`student_answers`](#student_answers)
- [`student_certificates`](#student_certificates)
- [`student_profiles`](#student_profiles)
- [`study_plans`](#study_plans)
- [`syllabus_items`](#syllabus_items)
- [`syllabus_progress`](#syllabus_progress)
- [`test_cases`](#test_cases)
- [`users`](#users)

---

### `ai_usage`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| user_id | UUID |  |
| module | String |  |
| tokens_used | Integer |  |
| cost | Float |  |
| created_at | DateTime |  |

### `announcement_batches`

| Column | Type | Notes |
|---|---|---|
| announcement_id | UUID |  |
| batch_id | UUID |  |

### `announcements`

| Column | Type | Notes |
|---|---|---|
| faculty_id | UUID |  |
| title | String |  |
| message | Text |  |

### `applications`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| job_id | UUID |  |
| student_id | UUID |  |
| match_score | Float |  |
| match_reasoning | Text |  |
| applied_at | DateTime |  |
| updated_at | DateTime |  |

### `assessments`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| title | String |  |
| description | Text |  |
| type | String |  |
| question_ids | JSON |  |
| batch_ids | JSON |  |
| duration | Integer |  |
| created_by | UUID |  |
| is_active | Boolean |  |
| active_from | DateTime |  |
| active_until | DateTime |  |
| max_violations | Integer |  |
| created_at | DateTime |  |

### `assignment_feedback`

| Column | Type | Notes |
|---|---|---|
| result_id | UUID |  |
| faculty_id | UUID |  |
| feedback_text | Text |  |
| score_override | Float |  |

### `assignment_submissions`

| Column | Type | Notes |
|---|---|---|
| assignment_id | UUID |  |
| user_id | UUID |  |
| submission_type | String |  |
| file_url | String |  |
| repo_link | String |  |
| status | String |  |
| faculty_feedback | Text |  |
| marks_obtained | Float |  |
| submitted_at | DateTime |  |
| reviewed_at | DateTime |  |

### `assignments`

| Column | Type | Notes |
|---|---|---|
| title | String |  |
| description | Text |  |
| syllabus_item_id | UUID |  |
| due_date | DateTime |  |
| max_marks | Float |  |
| created_by | UUID |  |

### `attendance`

| Column | Type | Notes |
|---|---|---|
| batch_id | UUID |  |
| student_id | UUID |  |
| date | Date |  |
| status | String |  |
| marked_by | UUID |  |
| method | String |  |
| mode | String |  |

### `audit_logs`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| user_id | UUID |  |
| action | String |  |
| module | String |  |
| entity_type | String |  |
| entity_id | String |  |
| details | JSONB |  |
| ip_address | String |  |
| created_at | DateTime |  |

### `batch_faculty`

| Column | Type | Notes |
|---|---|---|
| batch_id | UUID |  |
| faculty_id | UUID |  |
| role_in_batch | String |  |

### `batch_students`

| Column | Type | Notes |
|---|---|---|
| batch_id | UUID |  |
| user_id | UUID |  |

### `batches`

| Column | Type | Notes |
|---|---|---|
| name | String |  |
| course_id | UUID |  |
| status | String |  |

### `bulk_upload_jobs`

| Column | Type | Notes |
|---|---|---|
| file_name | String |  |
| file_url | String |  |
| status | String |  |
| total_rows | Integer |  |
| success_count | Integer |  |
| failed_count | Integer |  |
| uploaded_by | UUID |  |

### `career_readiness_scores`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| user_id | UUID |  |
| score | Float |  |
| breakdown | JSONB |  |
| computed_at | DateTime |  |

### `chat_history`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| user_id | UUID |  |
| faculty_id | UUID |  |
| student_id | UUID |  |
| message | Text |  |
| response | Text |  |
| created_at | DateTime |  |

### `code_reviews`

| Column | Type | Notes |
|---|---|---|
| coding_submission_id | UUID |  |
| review_text | Text |  |
| suggestions | JSONB |  |
| quality_score | Float |  |

### `coding_questions`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| question_id | UUID |  |
| starter_code | Text |  |
| language | String |  |
| created_at | DateTime |  |

### `coding_submissions`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| user_id | UUID |  |
| coding_question_id | UUID |  |
| code | Text |  |
| language | String |  |
| output | Text |  |
| status | String |  |
| score | Float |  |
| created_at | DateTime |  |

### `companies`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| name | String |  |
| industry | String |  |
| website | String |  |
| hr_contact_name | String |  |
| hr_contact_email | String |  |
| hr_contact_phone | String |  |
| address | Text |  |
| logo_url | String |  |
| notes | Text |  |
| created_by | UUID |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `courses`

| Column | Type | Notes |
|---|---|---|
| name | String |  |
| code | String |  |

### `daily_challenge_attempts`

| Column | Type | Notes |
|---|---|---|
| user_id | UUID |  |
| daily_challenge_id | UUID |  |
| answer_text | Text |  |
| is_correct | Boolean |  |
| solved_at | DateTime |  |

### `daily_challenges`

| Column | Type | Notes |
|---|---|---|
| challenge_date | DateTime |  |
| practice_question_id | UUID |  |

### `documents`

| Column | Type | Notes |
|---|---|---|
| document_type | String |  |
| file_url | String |  |
| file_name | String |  |
| uploaded_by | UUID |  |

### `fee_installments`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| fee_structure_id | UUID |  |
| installment_number | Integer |  |
| amount | Float |  |
| due_date | Date |  |
| status | String |  |
| paid_at | DateTime |  |

### `fee_structures`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| student_id | UUID |  |
| batch_id | UUID |  |
| total_amount | Float |  |
| plan_type | String |  |
| created_by | UUID |  |
| created_at | DateTime |  |

### `interviews`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| application_id | UUID |  |
| round_name | String |  |
| scheduled_at | DateTime |  |
| duration_minutes | Integer |  |
| mode | String |  |
| meeting_link | String |  |
| interviewer_id | UUID |  |
| status | String |  |
| recording_url | String |  |
| transcript | Text |  |
| ai_score | Float |  |
| ai_analysis | JSONB |  |
| interviewer_feedback | Text |  |
| interviewer_rating | Integer |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `jobs`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| company_id | UUID |  |
| title | String |  |
| description | Text |  |
| required_skills | JSONB |  |
| min_experience_years | Integer |  |
| min_score_percent | Float |  |
| job_type | String |  |
| location | String |  |
| salary_min | Numeric |  |
| salary_max | Numeric |  |
| openings | Integer |  |
| status | String |  |
| application_deadline | DateTime |  |
| target_batch_ids | JSONB |  |
| posted_by | UUID |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `leads`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| name | String |  |
| phone | String |  |
| email | String |  |
| course_interested | String |  |
| requirement | Text |  |
| source | String |  |
| status | String |  |
| notes | Text |  |
| assigned_to | UUID |  |
| created_by | UUID |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `lectures`

| Column | Type | Notes |
|---|---|---|
| syllabus_item_id | UUID |  |
| title | String |  |
| video_url | String |  |
| notes_url | String |  |
| duration_minutes | Integer |  |

### `mock_interview_evaluation`

| Column | Type | Notes |
|---|---|---|
| mock_interview_id | UUID |  |
| confidence_score | Float |  |
| communication_score | Float |  |
| technical_score | Float |  |
| overall_score | Float |  |
| max_score | Float |  |
| feedback_text | Text |  |
| improvement_suggestions | Text |  |

### `mock_interview_qna`

| Column | Type | Notes |
|---|---|---|
| mock_interview_id | UUID |  |
| question_text | Text |  |
| answer_text | Text |  |
| sequence | String |  |

### `mock_interviews`

| Column | Type | Notes |
|---|---|---|
| student_id | UUID |  |
| scheduled_by | UUID |  |
| batch_id | UUID |  |
| scheduled_at | DateTime |  |
| mode | String |  |
| status | String |  |
| recording_url | String |  |

### `notification_recipients`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| notification_id | UUID |  |
| user_id | UUID |  |
| is_read | Boolean |  |
| read_at | DateTime |  |
| delivered | Boolean |  |
| created_at | DateTime |  |

### `notifications`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| title | String |  |
| message | Text |  |
| type | String |  |
| channel | String |  |
| created_by | UUID |  |
| target_roles | JSONB |  |
| target_users | JSONB |  |
| status | String |  |
| scheduled_at | DateTime |  |
| sent_at | DateTime |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `offers`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| application_id | UUID |  |
| designation | String |  |
| salary_offered | Numeric |  |
| location | String |  |
| joining_date | DateTime |  |
| offer_letter_url | String |  |
| status | String |  |
| issued_at | DateTime |  |
| responded_at | DateTime |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `payments`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| user_id | UUID |  |
| batch_id | UUID |  |
| amount | Float |  |
| currency | String |  |
| status | String |  |
| payment_method | String |  |
| transaction_id | String |  |
| paid_at | DateTime |  |
| created_at | DateTime |  |

### `platform_settings`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| key | String |  |
| value | JSONB |  |
| updated_by | UUID |  |
| updated_at | DateTime |  |

### `practice_questions`

| Column | Type | Notes |
|---|---|---|
| topic | String |  |
| question_text | Text |  |
| type | String |  |
| data | JSONB |  |
| difficulty | String |  |

### `proctor_snapshots`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| result_id | UUID |  |
| user_id | UUID |  |
| assessment_id | UUID |  |
| image_path | String |  |
| violation_count | Integer |  |
| captured_at | DateTime |  |

### `questions`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| assessment_id | UUID |  |
| question_text | Text |  |
| type | String |  |
| data | JSON |  |
| marks | Integer |  |
| created_by | UUID |  |
| is_bank_item | Boolean |  |
| tags | ARRAY |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `registration_invites`

| Column | Type | Notes |
|---|---|---|
| token | String |  |
| status | String |  |
| expires_at | DateTime |  |
| created_by | UUID |  |

### `results`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| assessment_id | UUID |  |
| user_id | UUID |  |
| score | Float |  |
| status | String |  |
| started_at | DateTime |  |
| submitted_at | DateTime |  |
| violation_count | Integer |  |
| is_flagged | Boolean |  |
| is_terminated | Boolean |  |
| termination_reason | String |  |
| last_violation_reason | String |  |
| last_violation_severity | String |  |
| help_requested | Boolean |  |
| help_message | Text |  |
| ip_address | String |  |

### `resumes`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| user_id | UUID |  |
| content | JSONB |  |
| ai_generated_text | Text |  |
| version | Integer |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `sign_in_logs`

| Column | Type | Notes |
|---|---|---|
| user_id | UUID |  |
| status | String |  |

### `staff_attendance`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| staff_id | UUID |  |
| date | Date |  |
| status | String |  |
| marked_by | UUID |  |
| created_at | DateTime |  |

### `student_answers`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| result_id | UUID |  |
| question_id | UUID |  |
| answer_data | JSON |  |
| is_correct | Boolean |  |
| marks_awarded | Float |  |
| created_at | DateTime |  |

### `student_certificates`

| Column | Type | Notes |
|---|---|---|
| user_id | UUID |  |
| title | String |  |
| issuer | String |  |
| issue_date | DateTime |  |
| certificate_url | String |  |

### `student_profiles`

| Column | Type | Notes |
|---|---|---|
| photo_consent_given | Boolean |  |

### `study_plans`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| user_id | UUID |  |
| goal | String |  |
| plan_data | JSONB |  |
| created_at | DateTime |  |
| updated_at | DateTime |  |

### `syllabus_items`

| Column | Type | Notes |
|---|---|---|
| course_id | UUID |  |
| title | String |  |
| description | Text |  |
| order_index | Integer |  |
| module | String |  |

### `syllabus_progress`

| Column | Type | Notes |
|---|---|---|
| user_id | UUID |  |
| syllabus_item_id | UUID |  |
| status | String |  |
| completed_at | DateTime |  |

### `test_cases`

| Column | Type | Notes |
|---|---|---|
| id | UUID |  |
| coding_question_id | UUID |  |
| input | Text |  |
| expected_output | Text |  |
| is_hidden | Boolean |  |

### `users`

| Column | Type | Notes |
|---|---|---|
| name | String |  |
| email | String |  |
| password_hash | String |  |
| role | String |  |
| is_active | Boolean |  |
| must_change_password | Boolean |  |

