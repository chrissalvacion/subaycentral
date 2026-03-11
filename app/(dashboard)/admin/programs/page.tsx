"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Program } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";

type FormData = { name: string; description: string; required_hours: string };
const defaultForm: FormData = { name: "", description: "", required_hours: "600" };

export default function ProgramsPage() {
  const supabase = createClient();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("programs")
      .select("*")
      .order("name");
    if (data) setPrograms(data as Program[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(p: Program) {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", required_hours: String(p.required_hours) });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description || null,
      required_hours: parseInt(form.required_hours, 10),
    };
    try {
      if (editing) {
        const { error: err } = await supabase.from("programs").update(payload).eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("programs").insert(payload);
        if (err) throw err;
      }
      await fetch();
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Program) {
    if (!confirm(`Delete program "${p.name}"?`)) return;
    const { error: err } = await supabase.from("programs").delete().eq("id", p.id);
    if (err) alert(err.message);
    else await fetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Program Management</h1>
          <p className="text-slate-500 text-sm">Manage OJT programs</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={16} />}>Add Program</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><LoadingSpinner /></div>
        ) : programs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No programs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Program Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Required Hours</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Created</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-xs truncate">{p.description ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{p.required_hours} hrs</td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Program" : "Add Program"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Program Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          <Input label="Required Hours" type="number" min="1" value={form.required_hours} onChange={(e) => setForm({ ...form, required_hours: e.target.value })} required />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Add Program"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
