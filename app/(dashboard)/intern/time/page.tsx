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

function getMonthRange(year: string, month: string) {
  const y = Number(year);
  const m = Number(month);

  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return null;
  }

  const start = `${year}-${month.padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(y, m, 1));
  const nextMonthYear = String(nextMonth.getUTCFullYear());
  const nextMonthValue = String(nextMonth.getUTCMonth() + 1).padStart(2, "0");
  const endExclusive = `${nextMonthYear}-${nextMonthValue}-01`;

  return { start, endExclusive };
}

type DutyType = "full" | "half_am" | "half_pm";

type FormData = {
  date: string;
  dutyType: DutyType;
  morning_time_in: string;
  morning_time_out: string;
  afternoon_time_in: string;
  afternoon_time_out: string;
};

const defaultForm: FormData = {
  date: "",
  dutyType: "full",
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
  return diffMs / (1000 * 60 * 60); // decimal hours (e.g. 4.75 = 4h 45m)
}

export default function TimeRecordsPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [internDeploymentId, setInternDeploymentId] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const current = getCurrentMonthYear();
    setMonth(current.month);
    setYear(current.year);
  }, []);

  const load = useCallback(async () => {
    if (!profile || !month || !year) return;
    const range = getMonthRange(year, month);
    if (!range) return;

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
      .gte("date", range.start)
      .lt("date", range.endExclusive)
      .order("date", { descending: false });
    setRecords((data as RecordRow[]) ?? []);
    setLoading(false);
  }, [profile, supabase, month, year]);

  useEffect(() => { load(); }, [load]);

  async function syncDeploymentHours() {
    if (!internDeploymentId || !profile) return;

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
      (deploymentTimeRows ?? []).reduce(
        (sum: number, row: { total_hours: number | null }) =>
          sum + Number(row.total_hours ?? 0),
        0
      ).toFixed(2)
    );

    const expectedEndDate = calculateExpectedEndDate(
      deploymentRow?.start_date,
      deploymentRow?.required_hours,
      renderedHoursFromLogs,
      profile.duty_hours_per_day ?? 8,
      profile.duty_days_per_week ?? 5
    );

    await supabase
      .from("intern_deployments")
      .update({
        rendered_hours: renderedHoursFromLogs,
        expected_end_date: expectedEndDate,
      })
      .eq("id", internDeploymentId);
  }

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
    const hasMorning = Boolean(r.morning_time_in || r.time_in);
    const hasAfternoon = Boolean(r.afternoon_time_in);
    let dutyType: DutyType = "full";
    if (hasMorning && !hasAfternoon) dutyType = "half_am";
    else if (!hasMorning && hasAfternoon) dutyType = "half_pm";
    setForm({
      date: r.date,
      dutyType,
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

    const showMorning = form.dutyType === "full" || form.dutyType === "half_am";
    const showAfternoon = form.dutyType === "full" || form.dutyType === "half_pm";

    const morningComplete = !showMorning || Boolean(form.morning_time_in && form.morning_time_out);
    const afternoonComplete = !showAfternoon || Boolean(form.afternoon_time_in && form.afternoon_time_out);

    if (!morningComplete) {
      setError("Please provide both morning time in and time out.");
      return;
    }

    if (!afternoonComplete) {
      setError("Please provide both afternoon time in and time out.");
      return;
    }

    const effectiveMorningIn = showMorning ? form.morning_time_in : "";
    const effectiveMorningOut = showMorning ? form.morning_time_out : "";
    const effectiveAfternoonIn = showAfternoon ? form.afternoon_time_in : "";
    const effectiveAfternoonOut = showAfternoon ? form.afternoon_time_out : "";

    const morningHours = computeRangeHours(effectiveMorningIn, effectiveMorningOut);
    if (morningHours < 0) {
      setError("Morning time out must be later than morning time in.");
      return;
    }

    const afternoonHours = computeRangeHours(effectiveAfternoonIn, effectiveAfternoonOut);
    if (afternoonHours < 0) {
      setError("Afternoon time out must be later than afternoon time in.");
      return;
    }

    const totalHours = morningHours + afternoonHours;
    const legacyTimeIn = effectiveMorningIn || effectiveAfternoonIn;
    const legacyTimeOut = effectiveAfternoonOut || effectiveMorningOut;

    setSaving(true);
    setError(null);
    const payload = {
      intern_id: currentProfile.id,
      intern_deployment_id: internDeploymentId,
      date: form.date,
      morning_time_in: effectiveMorningIn || null,
      morning_time_out: effectiveMorningOut || null,
      afternoon_time_in: effectiveAfternoonIn || null,
      afternoon_time_out: effectiveAfternoonOut || null,
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

      await syncDeploymentHours();

      await load();
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;

    const confirmed = window.confirm("Delete this time log?");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase.from("time_records").delete().eq("id", editing.id);
      if (deleteError) throw deleteError;

      await syncDeploymentHours();
      await load();
      setModalOpen(false);
      setEditing(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Time Records</h1>
          <p className="text-slate-500 text-sm">Track your total rendered hours each day</p>
        </div>
        <div className="flex gap-3">
          <Select options={getMonthOptions()} value={month} onChange={(e) => setMonth(e.target.value)} />
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-20 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
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
            <Button onClick={openCreate} icon={<Plus size={16} />} className="md:px-4 px-3">
            <span className="hidden md:inline">Time Log</span>
            </Button>
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
                  <th className="hidden md:table-cell text-left px-4 py-3 font-semibold text-slate-600">AM In</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-semibold text-slate-600">AM Out</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-semibold text-slate-600">PM In</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-semibold text-slate-600">PM Out</th>
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
                    <td className="hidden md:table-cell px-4 py-3 text-slate-600">{formatTime(r.morning_time_in ?? r.time_in)}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-slate-600">{formatTime(r.morning_time_out)}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-slate-600">{formatTime(r.afternoon_time_in)}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-slate-600">{formatTime(r.afternoon_time_out ?? r.time_out)}</td>
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duty Type</label>
            <div className="flex gap-3">
              {(["full", "half_am", "half_pm"] as DutyType[]).map((type) => (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                  <input
                    type="radio"
                    name="dutyType"
                    value={type}
                    checked={form.dutyType === type}
                    onChange={() => setForm({ ...form, dutyType: type })}
                    className="accent-indigo-600"
                  />
                  {type === "full" ? "Full Day" : type === "half_am" ? "AM Half Day" : "PM Half Day"}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(form.dutyType === "full" || form.dutyType === "half_am") && (
              <>
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
              </>
            )}
            {(form.dutyType === "full" || form.dutyType === "half_pm") && (
              <>
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
              </>
            )}
          </div>
          {(() => {
            const showMorningPreview = form.dutyType === "full" || form.dutyType === "half_am";
            const showAfternoonPreview = form.dutyType === "full" || form.dutyType === "half_pm";
            const morningH = showMorningPreview ? computeRangeHours(form.morning_time_in, form.morning_time_out) : 0;
            const afternoonH = showAfternoonPreview ? computeRangeHours(form.afternoon_time_in, form.afternoon_time_out) : 0;
            const previewTotal = (morningH > 0 ? morningH : 0) + (afternoonH > 0 ? afternoonH : 0);
            const hasEnoughData =
              (showMorningPreview ? form.morning_time_in && form.morning_time_out : true) ||
              (showAfternoonPreview ? form.afternoon_time_in && form.afternoon_time_out : true);
            if (!hasEnoughData) return null;
            return (
              <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5">
                <span className="text-sm font-medium text-indigo-700">Calculated Total Hours</span>
                <span className="text-base font-bold text-indigo-900">
                  {previewTotal > 0 ? `${previewTotal.toFixed(2)} hrs` : "—"}
                </span>
              </div>
            );
          })()}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            {editing && (
              <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
                Delete Time Log
              </Button>
            )}
            {/* <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button> */}
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Add Time Record"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
