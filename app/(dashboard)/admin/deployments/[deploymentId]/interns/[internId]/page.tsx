"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DailyRecord, Deployment, InternDeployment, PartnerAgency, Profile, TimeRecord } from "@/lib/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Select } from "@/components/ui/Select";
import { formatDate, formatHours, formatTime, getCurrentMonthYear, getMonthOptions } from "@/lib/utils";

type DeploymentRow = Deployment & {
  programs?: { name: string } | null;
};

type InternDeploymentRow = InternDeployment & {
  partner_agencies?: PartnerAgency | null;
  deployments?: DeploymentRow | null;
};

type DetailData = {
  profile: Profile | null;
  deployment: InternDeploymentRow | null;
  dailyRecords: DailyRecord[];
  timeRecords: TimeRecord[];
};

export default function AdminDeploymentInternProfilePage() {
  const supabase = createClient();
  const params = useParams<{ deploymentId: string; internId: string }>();
  const deploymentId = params?.deploymentId;
  const internId = params?.internId;

  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [data, setData] = useState<DetailData>({
    profile: null,
    deployment: null,
    dailyRecords: [],
    timeRecords: [],
  });

  useEffect(() => {
    const current = getCurrentMonthYear();
    setMonth(current.month);
    setYear(current.year);
  }, []);

  const load = useCallback(async () => {
    if (!deploymentId || !internId || !month || !year) return;

    setLoading(true);

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", internId)
      .eq("role", "intern")
      .single();

    const profile = (profileRow as Profile | null) ?? null;

    if (!profile) {
      setData({
        profile: null,
        deployment: null,
        dailyRecords: [],
        timeRecords: [],
      });
      setLoading(false);
      return;
    }

    const { data: deploymentRows } = await supabase
      .from("intern_deployments")
      .select("*, partner_agencies(*), deployments(*, programs(name))")
      .eq("deployment_id", deploymentId)
      .eq("intern_id", internId)
      .limit(1);

    const deployment = ((deploymentRows as InternDeploymentRow[] | null) ?? [])[0] ?? null;

    if (!deployment) {
      setData({
        profile,
        deployment: null,
        dailyRecords: [],
        timeRecords: [],
      });
      setLoading(false);
      return;
    }

    const [{ data: daily }, { data: time }] = await Promise.all([
      supabase
        .from("daily_records")
        .select("*")
        .eq("intern_deployment_id", deployment.id)
        .gte("date", `${year}-${month}-01`)
        .lte("date", `${year}-${month}-31`)
        .order("date", { ascending: false }),
      supabase
        .from("time_records")
        .select("*")
        .eq("intern_deployment_id", deployment.id)
        .gte("date", `${year}-${month}-01`)
        .lte("date", `${year}-${month}-31`)
        .order("date", { ascending: false }),
    ]);

    setData({
      profile,
      deployment,
      dailyRecords: (daily as DailyRecord[]) ?? [],
      timeRecords: (time as TimeRecord[]) ?? [],
    });

    setLoading(false);
  }, [deploymentId, internId, month, year, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data.profile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/admin/deployments" className="hover:text-indigo-700 hover:underline">
            Deployments
          </Link>
          <ChevronRight size={14} />
          <span className="text-slate-700 font-medium">Profile</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Intern profile not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/admin/deployments" className="hover:text-indigo-700 hover:underline">
            Deployments
          </Link>
          <ChevronRight size={14} />
          <Link href={`/admin/deployments/${deploymentId}`} className="hover:text-indigo-700 hover:underline">
            Deployment Details
          </Link>
          <ChevronRight size={14} />
          <span className="text-slate-700 font-medium">{data.profile.full_name}</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Intern Profile</h1>
          <p className="text-sm text-slate-500">Personal details, deployment details, and records</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Personal Details</p>
          <p><span className="text-slate-500">Full Name:</span> {data.profile.full_name}</p>
          <p><span className="text-slate-500">Email:</span> {data.profile.email}</p>
          <p><span className="text-slate-500">Phone:</span> {data.profile.phone ?? "-"}</p>
          <p><span className="text-slate-500">Program:</span> {data.profile.program ?? "-"}</p>
          <p><span className="text-slate-500">Section:</span> {data.profile.section ?? "-"}</p>
          <p><span className="text-slate-500">Student ID:</span> {data.profile.student_id ?? "-"}</p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Deployment Details</p>
          {data.deployment ? (
            <>
              <p><span className="text-slate-500">Deployment:</span> {data.deployment.deployments?.name ?? "-"}</p>
              <p><span className="text-slate-500">Program:</span> {data.deployment.deployments?.programs?.name ?? data.profile.program ?? "-"}</p>
              <p><span className="text-slate-500">School Year:</span> {data.deployment.deployments?.school_year ?? "-"}</p>
              <p><span className="text-slate-500">Semester:</span> {data.deployment.deployments?.semester ?? "-"}</p>
              <p><span className="text-slate-500">Agency:</span> {data.deployment.partner_agencies?.name ?? "-"}</p>
              <p><span className="text-slate-500">Start Date:</span> {formatDate(data.deployment.start_date)}</p>
              <p><span className="text-slate-500">Expected End:</span> {formatDate(data.deployment.expected_end_date)}</p>
              <p><span className="text-slate-500">Status:</span> <span className="capitalize">{data.deployment.status}</span></p>
              <p><span className="text-slate-500">Rendered Hours:</span> {formatHours(data.deployment.rendered_hours)}</p>
              <p><span className="text-slate-500">Required Hours:</span> {formatHours(data.deployment.required_hours ?? 0)}</p>
            </>
          ) : (
            <p className="text-slate-500">No deployment record found for this intern in this deployment.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <Select
            label="Month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            options={getMonthOptions()}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Year</label>
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Daily Records</h2>
          <p className="text-sm text-slate-500">Filtered by selected month and year</p>
        </div>
        {data.dailyRecords.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No daily records found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Date</th>
                  <th className="text-left font-medium px-5 py-3">Tasks</th>
                  <th className="text-left font-medium px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.dailyRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70 align-top">
                    <td className="px-5 py-3 text-slate-700 whitespace-nowrap">{formatDate(record.date)}</td>
                    <td className="px-5 py-3 text-slate-700 whitespace-pre-line">{record.tasks}</td>
                    <td className="px-5 py-3 text-slate-700 whitespace-pre-line">{record.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Time Records</h2>
          <p className="text-sm text-slate-500">Filtered by selected month and year</p>
        </div>
        {data.timeRecords.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No time records found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Date</th>
                  <th className="text-left font-medium px-5 py-3">AM In</th>
                  <th className="text-left font-medium px-5 py-3">AM Out</th>
                  <th className="text-left font-medium px-5 py-3">PM In</th>
                  <th className="text-left font-medium px-5 py-3">PM Out</th>
                  <th className="text-left font-medium px-5 py-3">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.timeRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-slate-700 whitespace-nowrap">{formatDate(record.date)}</td>
                    <td className="px-5 py-3 text-slate-700">{formatTime(record.morning_time_in ?? record.time_in)}</td>
                    <td className="px-5 py-3 text-slate-700">{formatTime(record.morning_time_out)}</td>
                    <td className="px-5 py-3 text-slate-700">{formatTime(record.afternoon_time_in)}</td>
                    <td className="px-5 py-3 text-slate-700">{formatTime(record.afternoon_time_out ?? record.time_out)}</td>
                    <td className="px-5 py-3 text-slate-700">{formatHours(record.total_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
