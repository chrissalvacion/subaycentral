"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DailyRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getMonthOptions, getCurrentMonthYear, formatDate } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";

type RecordRow = DailyRecord;

type FormData = {
  date: string;
  tasks: string;
  notes: string;
};

const defaultForm: FormData = { date: "", tasks: "", notes: "" };

export default function DailyRecordsPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const current = getCurrentMonthYear();

  const [internDeploymentId, setInternDeploymentId] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const currentProfile = profile;
    setLoading(true);
    const { data: dep } = await supabase
      .from("intern_deployments")
      .select("id")
      .eq("intern_id", currentProfile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!dep) {
      setInternDeploymentId(null);
      setRecords([]);
      setLoading(false);
      return;
    }
    setInternDeploymentId(dep.id);

    const { data } = await supabase
      .from("daily_records")
      .select("*")
      .eq("intern_deployment_id", dep.id)
      .gte("date", `${year}-${month}-01`)
      .lte("date", `${year}-${month}-31`)
      .order("date", { ascending: false });
    setRecords((data as RecordRow[]) ?? []);
    setLoading(false);
  }, [profile, supabase, month, year]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...defaultForm, date: `${year}-${month}-01` });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(r: RecordRow) {
    setEditing(r);
    setForm({ date: r.date, tasks: r.tasks, notes: r.notes ?? "" });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !internDeploymentId) return;
    const currentProfile = profile;
    setSaving(true);
    setError(null);
    const payload = {
      intern_id: currentProfile.id,
      intern_deployment_id: internDeploymentId,
      date: form.date,
      tasks: form.tasks,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        const { error: err } = await supabase.from("daily_records").update(payload).eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("daily_records").insert(payload);
        if (err) throw err;
      }
      await load();
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Records</h1>
          <p className="text-slate-500 text-sm">Log your daily accomplishments and notes</p>
        </div>
        <div className="flex gap-3">
          <Select options={getMonthOptions()} value={month} onChange={(e) => setMonth(e.target.value)} />
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-28 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          <Button onClick={openCreate} icon={<Plus size={16} />}>Add Record</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><LoadingSpinner /></div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No daily records for the selected month.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map((r) => (
              <div key={r.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="sm:w-40 flex-shrink-0">
                  <p className="font-semibold text-slate-900">{formatDate(r.date)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 whitespace-pre-line">{r.tasks}</p>
                  {r.notes && <p className="text-slate-500 text-sm mt-2">Notes: {r.notes}</p>}
                </div>
                <div className="flex-shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Daily Record" : "Add Daily Record"} maxWidth="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          <Textarea label="Tasks / Accomplishments" value={form.tasks} onChange={(e) => setForm({ ...form, tasks: e.target.value })} rows={6} required />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Add Record"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
