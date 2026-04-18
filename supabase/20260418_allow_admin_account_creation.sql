-- ============================================================
-- Allow Admin Account Creation Reliably
-- Date: 2026-04-18
-- Purpose:
--   1) Ensure handle_new_user always inserts a valid profile row,
--      including required duty_days_per_week.
--   2) Make admin profile update policy explicit with WITH CHECK.
-- ============================================================

BEGIN;

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
    phone,
    role,
    duty_hours_per_day,
    duty_days_per_week
  )
  VALUES (
    NEW.id,
    resolved_full_name,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name',  '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'middle_name', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name',   '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'program',     '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'section',     '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'student_id',  '')), ''),
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone',       '')), ''),
    resolved_role,
    8,
    5
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admin updates profiles" ON profiles;
CREATE POLICY "Admin updates profiles"
ON profiles
FOR UPDATE
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

COMMIT;
