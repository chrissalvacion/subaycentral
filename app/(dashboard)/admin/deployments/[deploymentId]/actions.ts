"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AssignAgencyInput = {
  internDeploymentId: string;
  deploymentId: string;
  agencyId: string;
  startDate: string | null;
  expectedEndDate: string | null;
  status: "pending" | "active" | "completed" | "withdrawn";
};

export async function assignInternAgency(input: AssignAgencyInput) {
  const server = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
    error: authError,
  } = await server.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Only admin can assign agencies." };
  }

  const validStatuses = new Set(["pending", "active", "completed", "withdrawn"]);
  if (!validStatuses.has(input.status)) {
    return { error: "Invalid status selected." };
  }

  const { data: existingAgency } = await admin
    .from("partner_agencies")
    .select("id")
    .eq("id", input.agencyId)
    .single();

  if (!existingAgency) {
    return { error: "Selected agency does not exist." };
  }

  const { data: enrollment } = await admin
    .from("intern_deployments")
    .select("id")
    .eq("id", input.internDeploymentId)
    .eq("deployment_id", input.deploymentId)
    .single();

  if (!enrollment) {
    return { error: "Intern deployment record not found." };
  }

  const { error: updateError } = await admin
    .from("intern_deployments")
    .update({
      agency_id: input.agencyId,
      start_date: input.startDate,
      expected_end_date: input.expectedEndDate,
      status: input.status,
    })
    .eq("id", input.internDeploymentId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null };
}