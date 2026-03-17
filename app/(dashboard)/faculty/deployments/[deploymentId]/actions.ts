"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EnrollInput = {
  deploymentId: string;
  internId: string;
  agencyId: string;
  startDate: string;
  expectedEndDate: string | null;
};

function normalizeValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeProgram(value: string | null | undefined) {
  const normalized = normalizeValue(value);
  if (normalized === "bsit" || normalized === "bs information technology") {
    return "bs information technology";
  }
  if (normalized === "bsis" || normalized === "bs information systems") {
    return "bs information systems";
  }
  return normalized;
}

export async function enrollAssignedIntern(input: EnrollInput) {
  const server = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
    error: authError,
  } = await server.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in." };
  }

  const { data: facultyProfile } = await admin
    .from("profiles")
    .select("id, role, program, section")
    .eq("id", user.id)
    .single();

  if (!facultyProfile || facultyProfile.role !== "faculty") {
    return { error: "Only faculty can enroll interns." };
  }

  if (!facultyProfile.program || !facultyProfile.section) {
    return { error: "Faculty profile must have program and section assigned." };
  }

  const [{ data: assignment }, { data: deployment }] = await Promise.all([
    admin
      .from("deployment_faculty")
      .select("id")
      .eq("faculty_id", user.id)
      .eq("deployment_id", input.deploymentId)
      .maybeSingle(),
    admin
      .from("deployments")
      .select("id, required_hours, programs(name)")
      .eq("id", input.deploymentId)
      .single(),
  ]);

  if (!deployment) {
    return { error: "Deployment not found." };
  }

  // Faculty can manage this deployment if explicitly assigned, or if deployment program matches faculty program.
  const canManageByAssignment = Boolean(assignment);
  const deploymentProgramName = Array.isArray(deployment.programs)
    ? deployment.programs[0]?.name ?? null
    : null;
  const canManageByProgram =
    normalizeProgram(deploymentProgramName) === normalizeProgram(facultyProfile.program);

  if (!canManageByAssignment && !canManageByProgram) {
    return { error: "You can only enroll interns for deployments assigned to you or matching your program." };
  }

  const { data: internProfile } = await admin
    .from("profiles")
    .select("id, role, program, section")
    .eq("id", input.internId)
    .single();

  if (!internProfile || internProfile.role !== "intern") {
    return { error: "Selected account is not a valid intern." };
  }

  if (
    normalizeProgram(internProfile.program) !== normalizeProgram(facultyProfile.program) ||
    normalizeValue(internProfile.section) !== normalizeValue(facultyProfile.section)
  ) {
    return { error: "Intern does not belong to your assigned program and section." };
  }

  const { data: existing } = await admin
    .from("intern_deployments")
    .select("id")
    .eq("intern_id", input.internId)
    .eq("deployment_id", input.deploymentId)
    .maybeSingle();

  if (existing) {
    return { error: "This intern is already enrolled in this deployment." };
  }

  const { data: existingAgencyAssignment } = await admin
    .from("intern_deployments")
    .select("id")
    .eq("intern_id", input.internId)
    .not("agency_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (existingAgencyAssignment) {
    return { error: "This intern is already assigned to an agency." };
  }

  const { error: insertError } = await admin.from("intern_deployments").insert({
    intern_id: input.internId,
    deployment_id: input.deploymentId,
    agency_id: input.agencyId,
    start_date: input.startDate,
    expected_end_date: input.expectedEndDate,
    required_hours: deployment.required_hours,
    status: "active",
    rendered_hours: 0,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  return { error: null };
}
