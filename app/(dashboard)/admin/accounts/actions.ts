"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createAccount(data: {
  full_name: string;
  email: string;
  password: string;
  role: "faculty" | "intern";
  phone?: string;
  student_id?: string;
}) {
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      role: data.role,
    },
  });

  if (error) throw new Error(error.message);

  // Patch extra fields into profile
  if (created.user && (data.phone || data.student_id)) {
    await admin
      .from("profiles")
      .update({ phone: data.phone ?? null, student_id: data.student_id ?? null })
      .eq("id", created.user.id);
  }

  revalidatePath("/admin/accounts");
  return created.user;
}

export async function updateAccount(
  userId: string,
  data: { full_name?: string; phone?: string; student_id?: string }
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update(data)
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/accounts");
}

export async function deleteAccount(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/accounts");
}

export async function resetPassword(userId: string, newPassword: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) throw new Error(error.message);
}
