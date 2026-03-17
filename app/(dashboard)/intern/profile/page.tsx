"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { calculateExpectedEndDate, formatDate, formatHours, getProgressPercent } from "@/lib/utils";
import { DeploymentStatusBadge } from "@/components/ui/Badge";

type ProfileView = {
  full_name: string;
  email: string;
  phone: string | null;
  student_id: string | null;
  start_date: string | null;
  expected_end_date: string | null;
  rendered_hours: number;
  required_hours: number;
  deployment_name: string;
  deployment_status: string;
  agency_name: string | null;
};

export default function InternProfilePage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [data, setData] = useState<ProfileView | null>(null);

  useEffect(() => {
    if (!profile) return;
    const currentProfile = profile;
    async function load() {
      const { data: dep } = await supabase
        .from("intern_deployments")
        .select("*, deployments(*), partner_agencies(*)")
        .eq("intern_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { data: timeRecords } = await supabase
        .from("time_records")
        .select("total_hours")
        .eq("intern_deployment_id", dep?.id || "");

      const accumulatedHoursFromLogs = Number(
        ((timeRecords ?? []).reduce(
          (sum: number, row: { total_hours: number | null }) => sum + Number(row.total_hours ?? 0),
          0
        )).toFixed(2)
      );
      const renderedHours = Number(
        (dep?.rendered_hours ?? accumulatedHoursFromLogs).toFixed(2)
      );

      const requiredHours = dep?.required_hours ?? dep?.deployments?.required_hours ?? 0;
      const computedExpectedEndDate = calculateExpectedEndDate(
        dep?.start_date ?? null,
        requiredHours,
        renderedHours,
        currentProfile.duty_hours_per_day ?? 8,
        currentProfile.duty_days_per_week ?? 5
      );

      setData({
        full_name: currentProfile.full_name,
        email: currentProfile.email,
        phone: currentProfile.phone,
        student_id: currentProfile.student_id,
        start_date: dep?.start_date ?? null,
        expected_end_date: computedExpectedEndDate,
        rendered_hours: renderedHours,
        required_hours: requiredHours,
        deployment_name: dep?.deployments?.name ?? "No Deployment",
        deployment_status: dep?.deployments?.status ?? "upcoming",
        agency_name: dep?.partner_agencies?.name ?? null,
      });
    }
    load();
  }, [profile, supabase]);

  if (!data) {
    return <div className="text-slate-400 text-sm">Loading profile...</div>;
  }

  const progress = getProgressPercent(data.rendered_hours, data.required_hours);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm">Your internship details and progress</p>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <span className="text-indigo-700 font-bold text-xl">{data.full_name[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{data.full_name}</h2>
            <p className="text-slate-500 text-sm">{data.email}</p>
            {data.student_id && <p className="text-slate-400 text-sm">Student ID: {data.student_id}</p>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Personal Information">
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-500">Phone:</span> {data.phone ?? "—"}</p>
            <p><span className="text-slate-500">Student ID:</span> {data.student_id ?? "—"}</p>
          </div>
        </Card>

        <Card title="Deployment Information">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Deployment:</span>
              <span className="text-slate-800">{data.deployment_name}</span>
              <DeploymentStatusBadge status={data.deployment_status} />
            </div>
            <p><span className="text-slate-500">Agency:</span> {data.agency_name ?? "—"}</p>
            <p><span className="text-slate-500">Start Date:</span> {formatDate(data.start_date)}</p>
            <p><span className="text-slate-500">Expected End:</span> {formatDate(data.expected_end_date)}</p>
          </div>
        </Card>
      </div>

      <Card title="Progress Overview">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Rendered Hours</span>
            <span className="font-medium text-slate-800">{formatHours(data.rendered_hours)} / {formatHours(data.required_hours)}</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-500">{progress}% of required OJT hours completed</p>
        </div>
      </Card>
    </div>
  );
}
