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
  role: "admin" | "faculty" | "intern";
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
      // Include all optional fields so the DB trigger can populate the
      // profile row fully without relying on column DEFAULTs for text fields.
      phone: data.phone ?? null,
      student_id: data.student_id ?? null,
      program: data.program ?? null,
      section: data.section ?? null,
    },
  });

  if (error) {
    // Surface a clearer message for the most common trigger-failure case.
    if (error.message.toLowerCase().includes("database error")) {
      throw new Error(
        "Account creation failed due to a database error. " +
          "This is usually caused by an outdated database trigger. " +
          "Please run the migration in supabase/20260331_fix_handle_new_user_trigger.sql " +
          "via the Supabase SQL Editor and try again."
      );
    }
    throw new Error(error.message);
  }

  // Upsert extra profile fields that may not have been set by the trigger.
  if (created.user) {
    await admin
      .from("profiles")
      .upsert(
        {
          id: created.user.id,
          full_name: data.full_name,
          email: data.email,
          role: data.role,
          phone: data.phone ?? null,
          student_id: data.student_id ?? null,
          program: data.program ?? null,
          section: data.section ?? null,
        },
        { onConflict: "id", ignoreDuplicates: false }
      );
  }

  revalidatePath("/admin/accounts");
  return created.user;
}

export async function updateAccount(
  userId: string,
  data: {
    full_name?: string;
    email?: string;
    role?: "admin" | "faculty" | "intern";
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

  const normalizedProfileData = {
    ...profileData,
    student_id:
      data.role === "intern"
        ? data.student_id ?? null
        : data.student_id === undefined
          ? undefined
          : null,
    program:
      data.role === "admin"
        ? null
        : data.program,
    section:
      data.role === "admin"
        ? null
        : data.section,
  };

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
    .update(normalizedProfileData)
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
