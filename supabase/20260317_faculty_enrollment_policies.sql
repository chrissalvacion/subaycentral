-- ============================================================
-- Faculty Enrollment Policy Update
-- Date: 2026-03-17
-- Purpose:
--   Allow faculty to enroll interns directly from the faculty
--   deployment page, scoped by faculty program/section and
--   deployment ownership rules.
-- ============================================================

BEGIN;

-- Helper function: faculty may manage deployment if explicitly assigned,
-- or if deployment program matches the faculty program.
CREATE OR REPLACE FUNCTION can_faculty_manage_deployment(target_deployment_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    get_current_user_role() = 'faculty'
    AND normalize_program_value(get_current_user_program()) <> ''
    AND normalize_text_value(get_current_user_section()) <> ''
    AND EXISTS (
      SELECT 1
      FROM deployments d
      LEFT JOIN programs pr ON pr.id = d.program_id
      WHERE d.id = target_deployment_id
        AND (
          EXISTS (
            SELECT 1
            FROM deployment_faculty df
            WHERE df.deployment_id = d.id
              AND df.faculty_id = auth.uid()
          )
          OR normalize_program_value(pr.name) = normalize_program_value(get_current_user_program())
        )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Replace faculty intern_deployments policies with enrollment-capable ones.
DROP POLICY IF EXISTS "Faculty reads own deployments' interns" ON intern_deployments;
DROP POLICY IF EXISTS "Faculty updates intern_deployments" ON intern_deployments;
DROP POLICY IF EXISTS "Faculty inserts intern_deployments" ON intern_deployments;

CREATE POLICY "Faculty reads own deployments' interns"
ON intern_deployments
FOR SELECT
USING (
  can_faculty_manage_deployment(deployment_id)
  AND intern_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'intern'
      AND normalize_program_value(p.program) = normalize_program_value(get_current_user_program())
      AND normalize_text_value(p.section) = normalize_text_value(get_current_user_section())
  )
);

CREATE POLICY "Faculty inserts intern_deployments"
ON intern_deployments
FOR INSERT
WITH CHECK (
  can_faculty_manage_deployment(deployment_id)
  AND intern_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'intern'
      AND normalize_program_value(p.program) = normalize_program_value(get_current_user_program())
      AND normalize_text_value(p.section) = normalize_text_value(get_current_user_section())
  )
);

CREATE POLICY "Faculty updates intern_deployments"
ON intern_deployments
FOR UPDATE
USING (
  can_faculty_manage_deployment(deployment_id)
  AND intern_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'intern'
      AND normalize_program_value(p.program) = normalize_program_value(get_current_user_program())
      AND normalize_text_value(p.section) = normalize_text_value(get_current_user_section())
  )
)
WITH CHECK (
  can_faculty_manage_deployment(deployment_id)
  AND intern_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'intern'
      AND normalize_program_value(p.program) = normalize_program_value(get_current_user_program())
      AND normalize_text_value(p.section) = normalize_text_value(get_current_user_section())
  )
);

COMMIT;
