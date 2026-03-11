"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TimeRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getMonthOptions, getCurrentMonthYear, formatDate, formatTime, formatHours } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";

type RecordRow = TimeRecord;

type FormData = {
  date: string;
  time_in: string;
  time_out: string;
};

const defaultForm: FormData = { date: "", time_in: "", time_out: "" };

function computeHours(timeIn: string, timeOut: string) {
  if (!timeIn || !timeOut) return null;
  const inDate = new Date(`1970-01-01T${timeIn}:00`);
  const outDate = new Date(`1970-01-01T${timeOut}:00`);
  const diffMs = outDate.getTime() - inDate.getTime();
  if (diffMs <= 0) return null;
  return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
}

export default function TimeRecordsPage() {
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
      .from("time_records")
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
    setForm({ date: r.date, time_in: r.time_in ?? "", time_out: r.time_out ?? "" });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !internDeploymentId) return;
    const currentProfile = profile;
    const totalHours = computeHours(form.time_in, form.time_out);
    if (totalHours == null) {
      setError("Time out must be later than time in.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      intern_id: currentProfile.id,
      intern_deployment_id: internDeploymentId,
      date: form.date,
      time_in: form.time_in,
      time_out: form.time_out,
      total_hours: totalHours,
    };
    try {
      if (editing) {
        const { error: err } = await supabase.from("time_records").update(payload).eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("time_records").insert(payload);
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
          <h1 className="text-2xl font-bold text-slate-900">Time Records</h1>
          <p className="text-slate-500 text-sm">Track your daily time in and time out</p>
        </div>
        <div className="flex gap-3">
          <Select options={getMonthOptions()} value={month} onChange={(e) => setMonth(e.target.value)} />
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-28 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          <Button onClick={openCreate} icon={<Plus size={16} />}>Add Time Log</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><LoadingSpinner /></div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No time records for the selected month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Time In</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Time Out</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Hours</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTime(r.time_in)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTime(r.time_out)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatHours(r.total_hours)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Pencil size={15} />
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Time Record" : "Add Time Record"} maxWidth="md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <Input label="Time In" type="time" value={form.time_in} onChange={(e) => setForm({ ...form, time_in: e.target.value })} required />
          <Input label="Time Out" type="time" value={form.time_out} onChange={(e) => setForm({ ...form, time_out: e.target.value })} required />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Add Time Record"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
