"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { RoleBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import {
  createAccount,
  updateAccount,
  deleteAccount,
  resetPassword,
} from "./actions";
import { Plus, Search, MoreVertical } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "faculty", label: "Faculty" },
  { value: "intern", label: "Intern" },
];

type FormData = {
  full_name: string;
  email: string;
  password: string;
  role: "admin" | "faculty" | "intern";
  phone: string;
  student_id: string;
  program: string;
  section: string;
};

const defaultForm: FormData = {
  full_name: "",
  email: "",
  password: "",
  role: "faculty",
  phone: "",
  student_id: "",
  program: "",
  section: "",
};

export default function AccountsPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [filtered, setFiltered] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"admin" | "faculty" | "intern">("faculty");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const [{ data: profileData }, { data: programData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .in("role", ["admin", "faculty", "intern"])
        .order("created_at", { ascending: false }),
      supabase
        .from("programs")
        .select("id, name")
        .order("name", { ascending: true }),
    ]);
    if (profileData) {
      setProfiles(profileData as Profile[]);
      setFiltered(profileData as Profile[]);
    }
    if (programData) {
      setPrograms(programData as { id: string; name: string }[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    let result = profiles.filter((p) => p.role === activeTab);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, activeTab, profiles]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, pageSize]);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(profile: Profile) {
    setEditing(profile);
    setForm({
      full_name: profile.full_name,
      email: profile.email,
      password: "",
      role: profile.role as "admin" | "faculty" | "intern",
      phone: profile.phone ?? "",
      student_id: profile.student_id ?? "",
      program: profile.program ?? "",
      section: profile.section ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        if (form.password && form.password.length < 6) {
          setError("Password must be at least 6 characters.");
          setSaving(false);
          return;
        }

        await updateAccount(editing.id, {
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          password: form.password || undefined,
          phone: form.phone || undefined,
          student_id: form.role === "intern" ? form.student_id || null : null,
          program: form.role === "admin" ? null : form.program || null,
          section: form.role === "admin" ? null : form.section || null,
        });
      } else {
        if (!form.password || form.password.length < 6) {
          setError("Password must be at least 6 characters.");
          setSaving(false);
          return;
        }
        await createAccount({
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone || undefined,
          student_id: form.role === "intern" ? form.student_id || undefined : undefined,
          program: form.role === "admin" ? undefined : form.program || undefined,
          section: form.role === "admin" ? undefined : form.section || undefined,
        });
      }
      await fetchProfiles();
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profile: Profile) {
    if (
      !confirm(
        `Delete account for "${profile.full_name}"? This cannot be undone.`
      )
    )
      return;
    try {
      await deleteAccount(profile.id);
      await fetchProfiles();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete account");
    }
  }

  async function handleResetPassword(profile: Profile) {
    if (!confirm(`Reset password for "${profile.full_name}" to password123?`)) return;
    try {
      await resetPassword(profile.id, "password123");
      alert(`Password reset for ${profile.full_name}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reset password");
    }
  }

  const adminCount = profiles.filter((p) => p.role === "admin").length;
  const facultyCount = profiles.filter((p) => p.role === "faculty").length;
  const internCount = profiles.filter((p) => p.role === "intern").length;

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);
  const paginatedRows = filtered.slice(startIndex, endIndex);

  function goToPreviousPage() {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }

  function goToNextPage() {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Management</h1>
          <p className="text-slate-500 text-sm">
            Manage admin, faculty, and intern accounts
          </p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={16} />}>
          Add Account
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("admin")}
          className={[
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "admin"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700",
          ].join(" ")}
        >
          Admin ({adminCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("faculty")}
          className={[
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "faculty"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700",
          ].join(" ")}
        >
          Faculty ({facultyCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("intern")}
          className={[
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "intern"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700",
          ].join(" ")}
        >
          Intern ({internCount})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-visible min-h-[calc(100vh-18rem)] flex flex-col">
        {loading ? (
          <div className="p-10 flex justify-center flex-1 items-center">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm flex-1 flex items-center justify-center">
            No accounts found.
          </div>
        ) : (
          <>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    Role
                  </th>
                  {activeTab === "intern" && (
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">
                      Student ID
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">
                    Program
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden xl:table-cell">
                    Section
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">
                    Joined
                  </th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedRows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-700 text-xs font-semibold">
                            {p.full_name[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {p.full_name}
                          </p>
                          <p className="text-slate-500 text-xs sm:hidden">
                            {p.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                      {p.email}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={p.role} />
                    </td>
                    {activeTab === "intern" && (
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                        {p.student_id ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {p.program ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">
                      {p.section ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative group inline-block">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          aria-label="Open actions"
                        >
                          <MoreVertical size={15} />
                        </button>
                        <div className="absolute right-0 top-7 z-20 min-w-44 bg-white border border-slate-200 rounded-lg shadow-lg p-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all">
                          <button
                            type="button"
                            onClick={() => handleResetPassword(p)}
                            className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            className="w-full text-left px-3 py-2 text-sm rounded-md text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Show</span>
              <Select
                value={String(pageSize)}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                  { value: "100", label: "100" },
                  { value: "500", label: "500" },
                ]}
                className="w-24"
              />
              <span>rows</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-sm text-slate-500">
                {startIndex + 1}-{endIndex} of {totalRows}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={safeCurrentPage <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600 min-w-20 text-center">
                Page {safeCurrentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={safeCurrentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Account" : "Add Account"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Full Name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label={editing ? "Password (optional)" : "Initial Password"}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
            helperText={editing ? "Leave blank to keep current password." : "Minimum 6 characters."}
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as "admin" | "faculty" | "intern" })
            }
            options={ROLE_OPTIONS}
          />
          <Input
            label="Phone (optional)"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {(form.role === "intern" || editing?.role === "intern") && (
            <Input
              label="Student ID (optional)"
              value={form.student_id}
              onChange={(e) =>
                setForm({ ...form, student_id: e.target.value })
              }
            />
          )}

          {(form.role === "intern" || editing?.role === "intern") && (
            <>
              <Select
                label="Program"
                value={form.program}
                onChange={(e) => setForm({ ...form, program: e.target.value })}
                options={[
                  { value: "", label: "Select program" },
                  ...programs.map((program) => ({ value: program.name, label: program.name })),
                ]}
                required
              />
              <Input
                label="Section"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                placeholder="e.g. 3A"
                required
              />
            </>
          )}

          {(form.role === "faculty" || editing?.role === "faculty") && (
            <>
              <Select
                label="Assigned Program"
                value={form.program}
                onChange={(e) => setForm({ ...form, program: e.target.value })}
                options={[
                  { value: "", label: "Select program" },
                  ...programs.map((program) => ({ value: program.name, label: program.name })),
                ]}
                required
              />
              <Input
                label="Assigned Section"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                placeholder="e.g. 3A"
                required
              />
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save Changes" : "Create Account"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
