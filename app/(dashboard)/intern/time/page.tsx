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
import { calculateExpectedEndDate, getMonthOptions, getCurrentMonthYear, formatDate, formatTime, formatHours } from "@/lib/utils";
import { Plus, FileSpreadsheet } from "lucide-react";

type RecordRow = TimeRecord;

type FormData = {
  date: string;
  morning_time_in: string;
  morning_time_out: string;
  afternoon_time_in: string;
  afternoon_time_out: string;
};

const defaultForm: FormData = {
  date: "",
  morning_time_in: "",
  morning_time_out: "",
  afternoon_time_in: "",
  afternoon_time_out: "",
};

function computeRangeHours(timeIn: string, timeOut: string) {
  if (!timeIn || !timeOut) return 0;
  const inDate = new Date(`1970-01-01T${timeIn}:00`);
  const outDate = new Date(`1970-01-01T${timeOut}:00`);
  const diffMs = outDate.getTime() - inDate.getTime();
  if (diffMs <= 0) return -1;
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
      .order("date", { descending: false });
    setRecords((data as RecordRow[]) ?? []);
    setLoading(false);
  }, [profile, supabase, month, year]);

  useEffect(() => { load(); }, [load]);

  function exportAsExcelCsv() {
    if (records.length === 0) return;

    const headers = ["Date", "AM In", "AM Out", "PM In", "PM Out", "Total Hours"];
    const rows = records.map((record) => [
      record.date,
      record.morning_time_in ?? "",
      record.morning_time_out ?? "",
      record.afternoon_time_in ?? "",
      record.afternoon_time_out ?? "",
      `${record.total_hours ?? 0}`,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `time-records-${year}-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...defaultForm, date: `${year}-${month}-01` });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(r: RecordRow) {
    setEditing(r);
    setForm({
      date: r.date,
      morning_time_in: r.morning_time_in ?? r.time_in ?? "",
      morning_time_out: r.morning_time_out ?? "",
      afternoon_time_in: r.afternoon_time_in ?? "",
      afternoon_time_out: r.afternoon_time_out ?? r.time_out ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !internDeploymentId) return;
    const currentProfile = profile;

    const morningComplete = Boolean(form.morning_time_in && form.morning_time_out);
    const afternoonComplete = Boolean(form.afternoon_time_in && form.afternoon_time_out);

    if (!morningComplete && !afternoonComplete) {
      setError("Please provide complete morning or afternoon time in/out.");
      return;
    }

    if ((form.morning_time_in && !form.morning_time_out) || (!form.morning_time_in && form.morning_time_out)) {
      setError("Morning time in and time out must both be provided.");
      return;
    }

    if ((form.afternoon_time_in && !form.afternoon_time_out) || (!form.afternoon_time_in && form.afternoon_time_out)) {
      setError("Afternoon time in and time out must both be provided.");
      return;
    }

    const morningHours = computeRangeHours(form.morning_time_in, form.morning_time_out);
    if (morningHours < 0) {
      setError("Morning time out must be later than morning time in.");
      return;
    }

    const afternoonHours = computeRangeHours(form.afternoon_time_in, form.afternoon_time_out);
    if (afternoonHours < 0) {
      setError("Afternoon time out must be later than afternoon time in.");
      return;
    }

    const totalHours = Number((morningHours + afternoonHours).toFixed(2));
    const legacyTimeIn = form.morning_time_in || form.afternoon_time_in;
    const legacyTimeOut = form.afternoon_time_out || form.morning_time_out;

    setSaving(true);
    setError(null);
    const payload = {
      intern_id: currentProfile.id,
      intern_deployment_id: internDeploymentId,
      date: form.date,
      morning_time_in: form.morning_time_in || null,
      morning_time_out: form.morning_time_out || null,
      afternoon_time_in: form.afternoon_time_in || null,
      afternoon_time_out: form.afternoon_time_out || null,
      time_in: legacyTimeIn || null,
      time_out: legacyTimeOut || null,
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

      const [{ data: deploymentRow }, { data: deploymentTimeRows }] = await Promise.all([
        supabase
          .from("intern_deployments")
          .select("id, start_date, required_hours")
          .eq("id", internDeploymentId)
          .single(),
        supabase
          .from("time_records")
          .select("total_hours")
          .eq("intern_deployment_id", internDeploymentId),
      ]);

      const renderedHoursFromLogs = Number(
        ((deploymentTimeRows ?? []).reduce(
          (sum: number, row: { total_hours: number | null }) => sum + Number(row.total_hours ?? 0),
          0
        )).toFixed(2)
      );

      const expectedEndDate = calculateExpectedEndDate(
        deploymentRow?.start_date,
        deploymentRow?.required_hours,
        renderedHoursFromLogs,
        profile.duty_hours_per_day ?? 8
      );

      await supabase
        .from("intern_deployments")
        .update({
          rendered_hours: renderedHoursFromLogs,
          expected_end_date: expectedEndDate,
        })
        .eq("id", internDeploymentId);

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
          <p className="text-slate-500 text-sm">Track your morning and afternoon time logs each day</p>
        </div>
        <div className="flex gap-3">
          <Select options={getMonthOptions()} value={month} onChange={(e) => setMonth(e.target.value)} />
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-28 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          <Button
            type="button"
            variant="secondary"
            onClick={exportAsExcelCsv}
            icon={<FileSpreadsheet size={16} />}
            disabled={loading || records.length === 0}
            aria-label="Export time records excel file"
            title="Export as Excel CSV"
            className="px-3"
          />
          <Button onClick={openCreate} icon={<Plus size={16} />}>Time Log</Button>
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
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">AM In</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">PM Out</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(r)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTime(r.morning_time_in)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTime(r.afternoon_time_out)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatHours(r.total_hours)}</td>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Morning Time In"
              type="time"
              value={form.morning_time_in}
              onChange={(e) => setForm({ ...form, morning_time_in: e.target.value })}
            />
            <Input
              label="Morning Time Out"
              type="time"
              value={form.morning_time_out}
              onChange={(e) => setForm({ ...form, morning_time_out: e.target.value })}
            />
            <Input
              label="Afternoon Time In"
              type="time"
              value={form.afternoon_time_in}
              onChange={(e) => setForm({ ...form, afternoon_time_in: e.target.value })}
            />
            <Input
              label="Afternoon Time Out"
              type="time"
              value={form.afternoon_time_out}
              onChange={(e) => setForm({ ...form, afternoon_time_out: e.target.value })}
            />
          </div>
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
