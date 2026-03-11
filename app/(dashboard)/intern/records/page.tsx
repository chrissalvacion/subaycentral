"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DailyRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getMonthOptions, getCurrentMonthYear, formatDate } from "@/lib/utils";
import { Plus, ChevronRight, FileDown } from "lucide-react";

type RecordRow = DailyRecord;

export default function DailyRecordsPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const current = getCurrentMonthYear();

  const [internDeploymentId, setInternDeploymentId] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);

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

  function exportAsDocument() {
    if (records.length === 0) return;

    const rowsHtml = records
      .map((record) => {
        const notes = (record.notes ?? "-").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const tasks = record.tasks.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:8px;vertical-align:top;">${formatDate(record.date)}</td>
            <td style="border:1px solid #cbd5e1;padding:8px;vertical-align:top;white-space:pre-wrap;">${tasks}</td>
            <td style="border:1px solid #cbd5e1;padding:8px;vertical-align:top;white-space:pre-wrap;">${notes}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <h2>Daily Records (${month}/${year})</h2>
        <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;">
          <thead>
            <tr>
              <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Date</th>
              <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Tasks / Accomplishments</th>
              <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Notes</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-records-${year}-${month}.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
          <Button
            type="button"
            variant="secondary"
            onClick={exportAsDocument}
            icon={<FileDown size={16} />}
            disabled={loading || records.length === 0}
            aria-label="Export daily records document"
            title="Export as DOC"
            className="px-3"
          />
          <Link href="/intern/records/new">
            <Button icon={<Plus size={16} />}>Add Record</Button>
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 flex justify-center"><LoadingSpinner /></div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-slate-400 text-sm">No daily records for the selected month.</div>
        ) : (
          <>
            {records.map((r) => (
              <Link
                key={r.id}
                href={`/intern/records/${r.id}`}
                className="block bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{formatDate(r.date)}</p>
                    <p className="text-slate-700 mt-2 whitespace-pre-line line-clamp-2">{r.tasks}</p>
                    {r.notes && <p className="text-slate-500 text-sm mt-1 line-clamp-1">Notes: {r.notes}</p>}
                  </div>
                  <ChevronRight size={16} className="text-slate-400 flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
