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
        .select("morning_time_in, morning_time_out, afternoon_time_in, afternoon_time_out, time_in, time_out")
        .eq("intern_deployment_id", dep?.id || "");

      type TRRow = { morning_time_in: string | null; morning_time_out: string | null; afternoon_time_in: string | null; afternoon_time_out: string | null; time_in: string | null; time_out: string | null };
      
      function rangeHours(timeIn: string | null, timeOut: string | null): number {
        if (!timeIn || !timeOut) return 0;
        const inDate = new Date(`1970-01-01T${timeIn}:00`);
        const outDate = new Date(`1970-01-01T${timeOut}:00`);
        const diffMs = outDate.getTime() - inDate.getTime();
        return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
      }

      const computedHours = (timeRecords ?? []).reduce((sum: number, r: TRRow) => {
        const morningHours = rangeHours(r.morning_time_in, r.morning_time_out);
        const afternoonHours = rangeHours(r.afternoon_time_in, r.afternoon_time_out);
        const legacyHours = (morningHours === 0 && afternoonHours === 0)
          ? rangeHours(r.time_in, r.time_out)
          : 0;
        return sum + morningHours + afternoonHours + legacyHours;
      }, 0);

      const requiredHours = dep?.required_hours ?? dep?.deployments?.required_hours ?? 0;
      const computedExpectedEndDate = calculateExpectedEndDate(
        dep?.start_date ?? null,
        requiredHours,
        computedHours,
        currentProfile.duty_hours_per_day ?? 8
      );

      setData({
        full_name: currentProfile.full_name,
        email: currentProfile.email,
        phone: currentProfile.phone,
        student_id: currentProfile.student_id,
        start_date: dep?.start_date ?? null,
        expected_end_date: computedExpectedEndDate,
        rendered_hours: Number(computedHours.toFixed(2)),
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
