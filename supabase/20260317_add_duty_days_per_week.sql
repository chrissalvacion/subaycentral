-- ============================================================
-- Add duty_days_per_week to profiles
-- Date: 2026-03-17
-- ============================================================

BEGIN;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS duty_days_per_week SMALLINT DEFAULT 5;

UPDATE profiles
SET duty_days_per_week = 5
WHERE duty_days_per_week IS NULL;

ALTER TABLE profiles
ALTER COLUMN duty_days_per_week SET DEFAULT 5;

ALTER TABLE profiles
ALTER COLUMN duty_days_per_week SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_duty_days_per_week_check'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_duty_days_per_week_check
    CHECK (duty_days_per_week BETWEEN 1 AND 7);
  END IF;
END $$;

COMMIT;
