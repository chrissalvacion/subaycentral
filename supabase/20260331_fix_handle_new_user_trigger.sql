-- ============================================================
-- Fix handle_new_user trigger
-- Date: 2026-03-31
-- Reason:
--   The duty_days_per_week column was made NOT NULL by migration
--   20260317_add_duty_days_per_week.sql, but the trigger INSERT
--   never included it.  On some Postgres configurations the column
--   DEFAULT is not applied when the trigger omits the column,
--   causing "Database error creating new user" from Supabase.
--
--   Changes:
--   1. Explicitly insert duty_hours_per_day = 8 and
--      duty_days_per_week = 5 (matching their column defaults).
--   2. Normalize empty-string metadata values to NULL for all
--      optional text columns.
--   3. Add ON CONFLICT (id) DO NOTHING so that retrying a partly-
--      failed signup never breaks user creation again.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  incoming_role    TEXT;
  resolved_role    user_role := 'intern';
  resolved_full_name TEXT;
BEGIN
  -- Resolve role from metadata
  incoming_role := NEW.raw_user_meta_data->>'role';
  IF incoming_role IN ('admin', 'faculty', 'intern') THEN
    resolved_role := incoming_role::user_role;
  END IF;

  -- Resolve full_name with cascading fallbacks
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
    8,   -- duty_hours_per_day default
    5    -- duty_days_per_week default (NOT NULL column)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
