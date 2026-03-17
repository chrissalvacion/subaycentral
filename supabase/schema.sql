-- ============================================================
-- SubayCentral – OJT Daily Accomplishment & Time Monitoring
-- Full Database Schema with RLS Policies
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Custom ENUM Types
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'faculty', 'intern');
CREATE TYPE deployment_status AS ENUM ('upcoming', 'active', 'completed');
CREATE TYPE intern_status AS ENUM ('pending', 'active', 'completed', 'withdrawn');

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT NOT NULL,
  first_name  TEXT,
  middle_name TEXT,
  last_name   TEXT,
  program     TEXT,
  section     TEXT,
  email       TEXT NOT NULL,
  phone       TEXT,
  role        user_role NOT NULL DEFAULT 'intern',
  student_id  TEXT,
  duty_hours_per_day NUMERIC(4, 2) DEFAULT 8,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Programs
CREATE TABLE programs (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  required_hours INTEGER NOT NULL DEFAULT 600,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Partner Agencies
CREATE TABLE partner_agencies (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name           TEXT NOT NULL,
  address        TEXT,
  contact_person TEXT,
  contact_number TEXT,
  email          TEXT,
  intern_slot_limit INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Deployments (a class/batch of OJT)
CREATE TABLE deployments (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  program_id     UUID REFERENCES programs(id) ON DELETE SET NULL,
  school_year    TEXT,
  semester       TEXT,
  start_date     DATE,
  end_date       DATE,
  required_hours INTEGER NOT NULL DEFAULT 600,
  status         deployment_status NOT NULL DEFAULT 'upcoming',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Deployment → Faculty (many-to-many)
CREATE TABLE deployment_faculty (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE NOT NULL,
  faculty_id    UUID REFERENCES profiles(id)    ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (deployment_id, faculty_id)
);

-- Intern Deployments (enrollment record)
CREATE TABLE intern_deployments (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  intern_id          UUID REFERENCES profiles(id)         ON DELETE CASCADE NOT NULL,
  deployment_id      UUID REFERENCES deployments(id)      ON DELETE CASCADE NOT NULL,
  agency_id          UUID REFERENCES partner_agencies(id) ON DELETE SET NULL,
  start_date         DATE,
  expected_end_date  DATE,
  required_hours     INTEGER,
  rendered_hours     NUMERIC(10, 2) DEFAULT 0,
  status             intern_status NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (intern_id, deployment_id)
);

-- Daily Records (accomplishments/task logs)
CREATE TABLE daily_records (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  intern_id            UUID REFERENCES profiles(id)           ON DELETE CASCADE NOT NULL,
  intern_deployment_id UUID REFERENCES intern_deployments(id) ON DELETE CASCADE NOT NULL,
  date                 DATE NOT NULL,
  tasks                TEXT NOT NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (intern_id, date)
);

-- Time Records (daily login/logout)
CREATE TABLE time_records (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  intern_id            UUID REFERENCES profiles(id)           ON DELETE CASCADE NOT NULL,
  intern_deployment_id UUID REFERENCES intern_deployments(id) ON DELETE CASCADE NOT NULL,
  date                 DATE NOT NULL,
  morning_time_in      TIME,
  morning_time_out     TIME,
  afternoon_time_in    TIME,
  afternoon_time_out   TIME,
  time_in              TIME,
  time_out             TIME,
  total_hours          NUMERIC(5, 2),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (intern_id, date)
);

-- Feedback (faculty → intern)
CREATE TABLE feedback (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  faculty_id           UUID REFERENCES profiles(id)           ON DELETE SET NULL,
  intern_id            UUID REFERENCES profiles(id)           ON DELETE CASCADE NOT NULL,
  intern_deployment_id UUID REFERENCES intern_deployments(id) ON DELETE CASCADE NOT NULL,
  content              TEXT NOT NULL,
  performance_rating   INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 5),
  reaction             TEXT,
  intern_read_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HELPER FUNCTION: get current user's role
-- ============================================================
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION normalize_text_value(input TEXT)
RETURNS TEXT AS $$
  SELECT LOWER(TRIM(COALESCE(input, '')));
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION normalize_program_value(input TEXT)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN LOWER(TRIM(COALESCE(input, ''))) IN ('bsit', 'bs information technology') THEN 'bs information technology'
    WHEN LOWER(TRIM(COALESCE(input, ''))) IN ('bsis', 'bs information systems') THEN 'bs information systems'
    ELSE LOWER(TRIM(COALESCE(input, '')))
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_current_user_program()
RETURNS TEXT AS $$
  SELECT program FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_user_section()
RETURNS TEXT AS $$
  SELECT section FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile after auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  incoming_role TEXT;
  resolved_role user_role := 'intern';
  resolved_full_name TEXT;
BEGIN
  incoming_role := NEW.raw_user_meta_data->>'role';
  IF incoming_role IN ('admin', 'faculty', 'intern') THEN
    resolved_role := incoming_role::user_role;
  END IF;

  resolved_full_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  IF resolved_full_name IS NULL THEN
    resolved_full_name := NULLIF(
      TRIM(CONCAT_WS(
        ' ',
        NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'middle_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'last_name', '')
      )),
      ''
    );
  END IF;
  IF resolved_full_name IS NULL THEN
    resolved_full_name := COALESCE(NULLIF(SPLIT_PART(NEW.email, '@', 1), ''), 'New User');
  END IF;

  INSERT INTO profiles (
    id,
    full_name,
    first_name,
    middle_name,
    last_name,
    program,
    section,
    student_id,
    email,
    role
  )
  VALUES (
    NEW.id,
    resolved_full_name,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'middle_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'program',
    NEW.raw_user_meta_data->>'section',
    NEW.raw_user_meta_data->>'student_id',
    NEW.email,
    resolved_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at      BEFORE UPDATE ON profiles      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER programs_updated_at      BEFORE UPDATE ON programs      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agencies_updated_at      BEFORE UPDATE ON partner_agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER deployments_updated_at   BEFORE UPDATE ON deployments    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER intern_dep_updated_at    BEFORE UPDATE ON intern_deployments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER daily_rec_updated_at     BEFORE UPDATE ON daily_records   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER time_rec_updated_at      BEFORE UPDATE ON time_records    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER feedback_updated_at      BEFORE UPDATE ON feedback        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update rendered_hours in intern_deployments after time record changes
CREATE OR REPLACE FUNCTION update_rendered_hours()
RETURNS TRIGGER AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := COALESCE(NEW.intern_deployment_id, OLD.intern_deployment_id);
  UPDATE intern_deployments
  SET rendered_hours = (
    SELECT COALESCE(SUM(total_hours), 0)
    FROM time_records
    WHERE intern_deployment_id = v_id
  )
  WHERE id = v_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_time_record_change
  AFTER INSERT OR UPDATE OR DELETE ON time_records
  FOR EACH ROW EXECUTE FUNCTION update_rendered_hours();

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_agencies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE intern_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback           ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------
CREATE POLICY "Own profile readable"          ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admin reads all profiles"      ON profiles FOR SELECT USING (get_current_user_role() = 'admin');
CREATE POLICY "Admin inserts profiles"        ON profiles FOR INSERT WITH CHECK (get_current_user_role() = 'admin');
CREATE POLICY "Admin updates profiles"        ON profiles FOR UPDATE USING (get_current_user_role() = 'admin');
CREATE POLICY "Admin deletes profiles"        ON profiles FOR DELETE USING (get_current_user_role() = 'admin');
CREATE POLICY "User updates own profile"      ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Faculty reads assigned interns" ON profiles FOR SELECT USING (
  get_current_user_role() = 'faculty' AND
  normalize_program_value(get_current_user_program()) <> '' AND
  normalize_text_value(get_current_user_section()) <> '' AND
  role = 'intern' AND
  normalize_program_value(program) = normalize_program_value(get_current_user_program()) AND
  normalize_text_value(section) = normalize_text_value(get_current_user_section())
);

-- ---------- programs ----------
CREATE POLICY "Anyone reads programs"    ON programs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manages programs"   ON programs FOR ALL   USING (get_current_user_role() = 'admin');

-- ---------- partner_agencies ----------
CREATE POLICY "Anyone reads agencies"    ON partner_agencies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manages agencies"   ON partner_agencies FOR ALL   USING (get_current_user_role() = 'admin');

-- ---------- deployments ----------
CREATE POLICY "Anyone reads deployments" ON deployments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manages deployments" ON deployments FOR ALL USING (get_current_user_role() = 'admin');

-- ---------- deployment_faculty ----------
CREATE POLICY "Anyone reads dep_faculty"  ON deployment_faculty FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manages dep_faculty" ON deployment_faculty FOR ALL   USING (get_current_user_role() = 'admin');

-- ---------- intern_deployments ----------
CREATE POLICY "Admin manages intern_deployments" ON intern_deployments FOR ALL USING (get_current_user_role() = 'admin');
CREATE POLICY "Faculty reads own deployments' interns" ON intern_deployments FOR SELECT USING (
  get_current_user_role() = 'faculty' AND
  normalize_program_value(get_current_user_program()) <> '' AND
  normalize_text_value(get_current_user_section()) <> '' AND
  intern_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'intern'
      AND normalize_program_value(p.program) = normalize_program_value(get_current_user_program())
      AND normalize_text_value(p.section) = normalize_text_value(get_current_user_section())
  )
);
CREATE POLICY "Faculty updates intern_deployments" ON intern_deployments FOR UPDATE USING (
  get_current_user_role() = 'faculty' AND
  normalize_program_value(get_current_user_program()) <> '' AND
  normalize_text_value(get_current_user_section()) <> '' AND
  intern_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'intern'
      AND normalize_program_value(p.program) = normalize_program_value(get_current_user_program())
      AND normalize_text_value(p.section) = normalize_text_value(get_current_user_section())
  )
);
CREATE POLICY "Intern reads own deployments" ON intern_deployments FOR SELECT USING (intern_id = auth.uid());

-- ---------- daily_records ----------
CREATE POLICY "Intern manages own daily records" ON daily_records FOR ALL USING (intern_id = auth.uid());
CREATE POLICY "Faculty reads assigned interns daily" ON daily_records FOR SELECT USING (
  get_current_user_role() = 'faculty' AND
  normalize_program_value(get_current_user_program()) <> '' AND
  normalize_text_value(get_current_user_section()) <> '' AND
  intern_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'intern'
      AND normalize_program_value(p.program) = normalize_program_value(get_current_user_program())
      AND normalize_text_value(p.section) = normalize_text_value(get_current_user_section())
  )
);
CREATE POLICY "Admin reads all daily records" ON daily_records FOR SELECT USING (get_current_user_role() = 'admin');

-- ---------- time_records ----------
CREATE POLICY "Intern manages own time records"   ON time_records FOR ALL USING (intern_id = auth.uid());
CREATE POLICY "Faculty reads assigned time records" ON time_records FOR SELECT USING (
  get_current_user_role() = 'faculty' AND
  normalize_program_value(get_current_user_program()) <> '' AND
  normalize_text_value(get_current_user_section()) <> '' AND
  intern_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'intern'
      AND normalize_program_value(p.program) = normalize_program_value(get_current_user_program())
      AND normalize_text_value(p.section) = normalize_text_value(get_current_user_section())
  )
);
CREATE POLICY "Admin reads all time records" ON time_records FOR SELECT USING (get_current_user_role() = 'admin');

-- ---------- feedback ----------
CREATE POLICY "Faculty manages own feedback"   ON feedback FOR ALL    USING (faculty_id = auth.uid());
CREATE POLICY "Intern reads own feedback"      ON feedback FOR SELECT USING (intern_id = auth.uid());
CREATE POLICY "Admin reads all feedback"       ON feedback FOR SELECT USING (get_current_user_role() = 'admin');
