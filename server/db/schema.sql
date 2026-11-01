CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS management_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  roll_number text UNIQUE,
  profile_image_key text,
  academic_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  password_hash text,
  setup_token_hash text,
  setup_token_expires_at timestamptz,
  email_verified_at timestamptz,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_image_name text NOT NULL DEFAULT '',
  legacy_progress jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS interests jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_image_name text NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS legacy_progress jsonb;

CREATE TABLE IF NOT EXISTS student_auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('register', 'login', 'reset', 'migration')),
  code_digest text NOT NULL,
  payload jsonb,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  subject text NOT NULL,
  thumbnail_key text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES course_nodes(id) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN ('subject', 'unit', 'topic', 'lesson')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  section text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  join_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classroom_enrollments (
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (classroom_id, student_id)
);

CREATE TABLE IF NOT EXISTS classroom_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, title)
);

CREATE TABLE IF NOT EXISTS classroom_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classroom_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES classroom_posts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classroom_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES classroom_topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  external_url text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  node_id uuid REFERENCES course_nodes(id) ON DELETE SET NULL,
  subject text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  object_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0),
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  subject text NOT NULL,
  instructor text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  meeting_url text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  instructions text NOT NULL,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  classroom_topic_id uuid REFERENCES classroom_topics(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  subject text NOT NULL,
  due_at timestamptz,
  max_marks numeric(8,2),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  response_text text NOT NULL DEFAULT '',
  attachment_key text,
  attachment_filename text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),
  score numeric(8,2),
  feedback text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (assignment_id, student_id)
);

ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS attachment_filename text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  classroom_topic_id uuid REFERENCES classroom_topics(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  subject text NOT NULL,
  duration_minutes integer,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'short_answer', 'long_answer')),
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option integer,
  marks numeric(8,2) NOT NULL DEFAULT 1 CHECK (marks >= 0),
  position integer NOT NULL DEFAULT 0,
  CHECK (question_type <> 'multiple_choice' OR correct_option IS NULL OR correct_option >= 0)
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score numeric(8,2),
  total_marks numeric(8,2) NOT NULL DEFAULT 0,
  feedback text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS feedback text NOT NULL DEFAULT '';
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS classroom_topic_id uuid REFERENCES classroom_topics(id) ON DELETE SET NULL;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS classroom_topic_id uuid REFERENCES classroom_topics(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS assessment_responses (
  attempt_id uuid NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  selected_option integer,
  answer_text text,
  awarded_marks numeric(8,2),
  feedback text NOT NULL DEFAULT '',
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS learning_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  node_id uuid REFERENCES course_nodes(id) ON DELETE SET NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('course_accessed', 'lesson_started', 'lesson_completed', 'material_opened', 'assignment_submitted', 'assessment_attempted', 'live_class_joined')),
  subject text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_xp (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_xp_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_key text NOT NULL,
  points integer NOT NULL CHECK (points > 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, activity_key)
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  material_id uuid REFERENCES learning_materials(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid REFERENCES management_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_announcement_reads (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS courses_status_updated_idx ON courses(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS materials_course_position_idx ON learning_materials(course_id, position);
CREATE INDEX IF NOT EXISTS classes_starts_idx ON live_classes(starts_at);
CREATE INDEX IF NOT EXISTS activity_student_date_idx ON learning_activity(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS assignment_due_idx ON assignments(due_at);
CREATE INDEX IF NOT EXISTS assessment_window_idx ON assessments(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS student_auth_challenges_email_created_idx ON student_auth_challenges(email, created_at DESC);
CREATE INDEX IF NOT EXISTS enrollments_student_course_idx ON course_enrollments(student_id, course_id);
CREATE INDEX IF NOT EXISTS assignment_submissions_student_idx ON assignment_submissions(student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS assessment_attempts_student_idx ON assessment_attempts(student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS classroom_enrollments_student_idx ON classroom_enrollments(student_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS classroom_posts_recent_idx ON classroom_posts(classroom_id, status, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS classroom_resources_status_idx ON classroom_resources(classroom_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS assignments_classroom_due_idx ON assignments(classroom_id, due_at) WHERE classroom_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS assessments_classroom_schedule_idx ON assessments(classroom_id, starts_at) WHERE classroom_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS live_classes_classroom_schedule_idx ON live_classes(classroom_id, starts_at) WHERE classroom_id IS NOT NULL;
