"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  createProfile,
  deleteProfile,
  updateProfile,
  updateProfilePassword,
} from "@/lib/sqlite";

const sqliteMode = process.env.DEV_DB === "sqlite";

export async function createAccount(data: {
  full_name: string;
  email: string;
  password: string;
  role: "faculty" | "intern";
  phone?: string;
  student_id?: string;
  program?: string;
  section?: string;
}) {
  if (sqliteMode) {
    const created = createProfile(data);
    revalidatePath("/admin/accounts");
    return { id: created.id, email: created.email };
  }

  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      role: data.role,
      program: data.program,
      section: data.section,
    },
  });

  if (error) throw new Error(error.message);

  // Patch extra fields into profile
  if (created.user && (data.phone || data.student_id || data.program || data.section)) {
    await admin
      .from("profiles")
      .update({
        phone: data.phone ?? null,
        student_id: data.student_id ?? null,
        program: data.program ?? null,
        section: data.section ?? null,
      })
      .eq("id", created.user.id);
  }

  revalidatePath("/admin/accounts");
  return created.user;
}

export async function updateAccount(
  userId: string,
  data: {
    full_name?: string;
    email?: string;
    role?: "faculty" | "intern";
    password?: string;
    phone?: string;
    student_id?: string | null;
    program?: string | null;
    section?: string | null;
  }
) {
  if (sqliteMode) {
    const { password, ...profileData } = data;
    updateProfile(userId, profileData);
    if (password) {
      updateProfilePassword(userId, password);
    }
    revalidatePath("/admin/accounts");
    return;
  }

  const admin = createAdminClient();
  const { password, ...profileData } = data;

  if (data.email || password || data.full_name || data.role) {
    const { error: userError } = await admin.auth.admin.updateUserById(userId, {
      email: data.email,
      password,
      user_metadata: {
        full_name: data.full_name,
        role: data.role,
      },
    });

    if (userError) throw new Error(userError.message);
  }

  const { error } = await admin
    .from("profiles")
    .update(profileData)
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/accounts");
}

export async function deleteAccount(userId: string) {
  if (sqliteMode) {
    deleteProfile(userId);
    revalidatePath("/admin/accounts");
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/accounts");
}

export async function resetPassword(userId: string, newPassword: string) {
  if (sqliteMode) {
    updateProfilePassword(userId, newPassword);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) throw new Error(error.message);
}
