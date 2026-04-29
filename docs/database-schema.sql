-- PostgreSQL production schema for Competitive Exam Library / Reading Room Management.
-- Use UUIDs in production. This schema keeps business identifiers like student_code separately.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('super_admin', 'staff', 'student');
CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE membership_status AS ENUM ('active', 'expired', 'paused');
CREATE TYPE fee_status AS ENUM ('paid', 'pending', 'overdue');
CREATE TYPE seat_base_status AS ENUM ('available', 'reserved');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'manual_adjusted');
CREATE TYPE payment_method AS ENUM ('UPI', 'Cash', 'Card', 'Bank transfer');
CREATE TYPE notification_channel AS ENUM ('SMS', 'WhatsApp');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'failed');

CREATE TABLE libraries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  city text,
  address text,
  owner_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name text NOT NULL,
  email citext UNIQUE,
  mobile text,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE libraries
  ADD CONSTRAINT libraries_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id);

CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  study_hours numeric(5,2) NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE seats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  seat_number text NOT NULL,
  zone text,
  base_status seat_base_status NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (library_id, seat_number)
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  student_code text NOT NULL,
  full_name text NOT NULL,
  photo_url text,
  father_name text,
  gender gender_type,
  date_of_birth date,
  mobile text NOT NULL,
  email citext,
  full_address text,
  exam_track text,
  date_joined date NOT NULL,
  expiry_date date NOT NULL,
  membership_status membership_status NOT NULL DEFAULT 'active',
  shift_id uuid NOT NULL REFERENCES shifts(id),
  seat_id uuid NOT NULL REFERENCES seats(id),
  study_hours numeric(5,2) NOT NULL,
  monthly_fees numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  pending_amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  fee_status fee_status NOT NULL DEFAULT 'pending',
  qr_secret text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (library_id, student_code)
);

-- Prevent two active students from occupying the same seat in the same shift.
CREATE UNIQUE INDEX students_active_shift_seat_unique
  ON students(library_id, shift_id, seat_id)
  WHERE membership_status = 'active';

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL,
  billing_month text NOT NULL,
  paid_at date NOT NULL DEFAULT current_date,
  collected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'success',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (library_id, receipt_number)
);

CREATE TABLE attendance_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  check_in_at timestamptz,
  check_out_at timestamptz,
  source text NOT NULL DEFAULT 'qr',
  status attendance_status NOT NULL DEFAULT 'present',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attendance_student_date_idx
  ON attendance_logs(student_id, attendance_date DESC);

CREATE TABLE seat_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_seat_id uuid REFERENCES seats(id) ON DELETE SET NULL,
  to_seat_id uuid REFERENCES seats(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  moved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  type text NOT NULL,
  channel notification_channel NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status notification_status NOT NULL DEFAULT 'queued',
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE backup_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_id uuid NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  storage_key text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX students_search_idx ON students USING gin (
  to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(student_code, '') || ' ' || coalesce(mobile, '') || ' ' || coalesce(exam_track, ''))
);

CREATE INDEX students_fee_status_idx ON students(library_id, fee_status);
CREATE INDEX students_membership_status_idx ON students(library_id, membership_status);
CREATE INDEX payments_student_idx ON payments(student_id, paid_at DESC);
CREATE INDEX notifications_status_idx ON notifications(library_id, status);
