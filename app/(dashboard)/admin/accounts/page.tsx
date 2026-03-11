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
} from "./actions";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "faculty", label: "Faculty" },
  { value: "intern", label: "Intern" },
];

type FormData = {
  full_name: string;
  email: string;
  password: string;
  role: "faculty" | "intern";
  phone: string;
  student_id: string;
};

const defaultForm: FormData = {
  full_name: "",
  email: "",
  password: "",
  role: "intern",
  phone: "",
  student_id: "",
};

export default function AccountsPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filtered, setFiltered] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["faculty", "intern"])
      .order("created_at", { ascending: false });
    if (data) {
      setProfiles(data as Profile[]);
      setFiltered(data as Profile[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    let result = profiles;
    if (roleFilter !== "all") result = result.filter((p) => p.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, roleFilter, profiles]);

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
      role: profile.role as "faculty" | "intern",
      phone: profile.phone ?? "",
      student_id: profile.student_id ?? "",
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
        await updateAccount(editing.id, {
          full_name: form.full_name,
          phone: form.phone || undefined,
          student_id: form.student_id || undefined,
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
          student_id: form.student_id || undefined,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Management</h1>
          <p className="text-slate-500 text-sm">
            Manage faculty and intern accounts
          </p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={16} />}>
          Add Account
        </Button>
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
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="all">All Roles</option>
          <option value="faculty">Faculty</option>
          <option value="intern">Intern</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">
                    Student ID
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">
                    Joined
                  </th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
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
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {p.student_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            disabled={!!editing}
            helperText={editing ? "Email cannot be changed." : undefined}
          />
          {!editing && (
            <Input
              label="Initial Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              helperText="Minimum 6 characters."
            />
          )}
          <Select
            label="Role"
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as "faculty" | "intern" })
            }
            options={ROLE_OPTIONS}
            disabled={!!editing}
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
