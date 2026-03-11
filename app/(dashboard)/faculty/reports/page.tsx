"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Select } from "@/components/ui/Select";
import { getMonthOptions, getCurrentMonthYear, formatHours } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type InternReportSourceRow = {
  id: string;
  profiles: { full_name?: string } | null;
};

type DailySummaryRow = {
  intern_deployment_id: string;
};

type TimeSummaryRow = {
  intern_deployment_id: string;
  total_hours: number | null;
};

export default function FacultyReportsPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const current = getCurrentMonthYear();

  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ name: string; hours: number; dailyCount: number }[]>([]);

  useEffect(() => {
    if (!profile) return;
    const currentProfile = profile;
    async function load() {
      setLoading(true);
      const { data: depFac } = await supabase
        .from("deployment_faculty")
        .select("deployment_id")
        .eq("faculty_id", currentProfile.id);
      const deploymentIds =
        ((depFac as { deployment_id: string }[] | null) ?? []).map(
          (d) => d.deployment_id
        );
      if (deploymentIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: internDeps } = await supabase
        .from("intern_deployments")
        .select("id, intern_id, profiles(full_name)")
        .in("deployment_id", deploymentIds);
      const depIds =
        ((internDeps as { id: string }[] | null) ?? []).map((d) => d.id);

      const [{ data: daily }, { data: time }] = await Promise.all([
        supabase
          .from("daily_records")
          .select("intern_deployment_id")
          .in("intern_deployment_id", depIds)
          .gte("date", `${year}-${month}-01`)
          .lte("date", `${year}-${month}-31`),
        supabase
          .from("time_records")
          .select("intern_deployment_id, total_hours")
          .in("intern_deployment_id", depIds)
          .gte("date", `${year}-${month}-01`)
          .lte("date", `${year}-${month}-31`),
      ]);

      const map = new Map<string, { name: string; hours: number; dailyCount: number }>();
      ((internDeps as InternReportSourceRow[] | null) ?? []).forEach((dep) => {
        map.set(dep.id, {
          name: dep.profiles?.full_name ?? "Intern",
          hours: 0,
          dailyCount: 0,
        });
      });
      ((time as TimeSummaryRow[] | null) ?? []).forEach((row) => {
        const existing = map.get(row.intern_deployment_id);
        if (existing) existing.hours += Number(row.total_hours ?? 0);
      });
      ((daily as DailySummaryRow[] | null) ?? []).forEach((row) => {
        const existing = map.get(row.intern_deployment_id);
        if (existing) existing.dailyCount += 1;
      });

      setRows(Array.from(map.values()).sort((a, b) => b.hours - a.hours));
      setLoading(false);
    }
    load();
  }, [profile, supabase, month, year]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.hours += row.hours;
        acc.daily += row.dailyCount;
        return acc;
      },
      { hours: 0, daily: 0 }
    );
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm">Monthly accomplishment and time summaries</p>
        </div>
        <div className="flex gap-3">
          <Select options={getMonthOptions()} value={month} onChange={(e) => setMonth(e.target.value)} />
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-28 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><LoadingSpinner /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">No report data for the selected month.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Total Rendered Hours">
              <p className="text-3xl font-bold text-slate-900">{formatHours(totals.hours)}</p>
            </Card>
            <Card title="Total Daily Submissions">
              <p className="text-3xl font-bold text-slate-900">{totals.daily}</p>
            </Card>
          </div>

          <Card title="Intern Hours Overview">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Intern Breakdown">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Intern</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Rendered Hours</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Daily Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                      <td className="px-4 py-3 text-slate-600">{formatHours(row.hours)}</td>
                      <td className="px-4 py-3 text-slate-600">{row.dailyCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
