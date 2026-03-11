"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, StatCard } from "@/components/ui/Card";
import { DeploymentStatusBadge } from "@/components/ui/Badge";
import { calculateExpectedEndDate, formatDate, formatHours, getProgressPercent } from "@/lib/utils";
import { ClipboardList, Clock, Building2, CalendarDays } from "lucide-react";

type HomeData = {
  deploymentName: string;
  deploymentStatus: string;
  agencyName: string | null;
  startDate: string | null;
  endDate: string | null;
  renderedHours: number;
  requiredHours: number;
  dailyCount: number;
  timeCount: number;
};

export default function InternHomePage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const currentProfile = profile;
    async function load() {
      const { data: deployment } = await supabase
        .from("intern_deployments")
        .select("*, deployments(*), partner_agencies(*)")
        .eq("intern_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!deployment) {
        setLoading(false);
        return;
      }

      const [{ count: dailyCount }, timeRecordsResult] = await Promise.all([
        supabase
          .from("daily_records")
          .select("id", { count: "exact", head: true })
          .eq("intern_deployment_id", deployment.id),
        supabase
          .from("time_records")
          .select("morning_time_in, morning_time_out, afternoon_time_in, afternoon_time_out, time_in, time_out")
          .eq("intern_deployment_id", deployment.id),
      ]);

      const timeRecords = timeRecordsResult.data ?? [];

      function rangeHours(timeIn: string | null, timeOut: string | null): number {
        if (!timeIn || !timeOut) return 0;
        const inDate = new Date(`1970-01-01T${timeIn}:00`);
        const outDate = new Date(`1970-01-01T${timeOut}:00`);
        const diffMs = outDate.getTime() - inDate.getTime();
        return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
      }

      type TRRow = { morning_time_in: string | null; morning_time_out: string | null; afternoon_time_in: string | null; afternoon_time_out: string | null; time_in: string | null; time_out: string | null };
      const renderedHours = timeRecords.reduce((sum: number, r: TRRow) => {
        const morningHours = rangeHours(r.morning_time_in, r.morning_time_out);
        const afternoonHours = rangeHours(r.afternoon_time_in, r.afternoon_time_out);
        // Fallback to legacy time_in/time_out if new fields are absent
        const legacyHours = (morningHours === 0 && afternoonHours === 0)
          ? rangeHours(r.time_in, r.time_out)
          : 0;
        return sum + morningHours + afternoonHours + legacyHours;
      }, 0);

      const requiredHours = deployment.required_hours ?? deployment.deployments?.required_hours ?? 0;
      const computedExpectedEndDate = calculateExpectedEndDate(
        deployment.start_date,
        requiredHours,
        renderedHours,
        currentProfile.duty_hours_per_day ?? 8
      );

      setData({
        deploymentName: deployment.deployments?.name ?? "No Deployment",
        deploymentStatus: deployment.deployments?.status ?? "upcoming",
        agencyName: deployment.partner_agencies?.name ?? null,
        startDate: deployment.start_date,
        endDate: computedExpectedEndDate,
        renderedHours: Number(renderedHours.toFixed(2)),
        requiredHours,
        dailyCount: dailyCount ?? 0,
        timeCount: timeRecords.length,
      });
      setLoading(false);
    }
    load();
  }, [profile, supabase]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-xl border border-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
        You are not yet assigned to a deployment.
      </div>
    );
  }

  const progress = getProgressPercent(data.renderedHours, data.requiredHours);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Home</h1>
        <p className="text-slate-500 text-sm">Overview of your current deployment</p>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-slate-900">{data.deploymentName}</h2>
              <DeploymentStatusBadge status={data.deploymentStatus} />
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p className="flex items-center gap-2"><Building2 size={15} /> {data.agencyName ?? "No agency assigned yet"}</p>
              <p className="flex items-center gap-2"><CalendarDays size={15} /> Actual Start Date: {formatDate(data.startDate)} - Estimated End Date: {formatDate(data.endDate)}</p>
              {/* <p className="pl-6">Estimated Finish Date: {formatDate(data.endDate)}</p> */}
            </div>
          </div>
          <div className="w-full md:max-w-xs">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-500">OJT Progress</span>
              <span className="font-medium text-slate-800">{progress}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {formatHours(data.renderedHours)} / {formatHours(data.requiredHours)} completed
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Rendered Hours" value={formatHours(data.renderedHours)} icon={<Clock size={22} />} iconBg="bg-amber-100 text-amber-600" />
        <StatCard title="Required Hours" value={formatHours(data.requiredHours)} icon={<Clock size={22} />} iconBg="bg-blue-100 text-blue-600" />
        <StatCard title="Daily Records" value={data.dailyCount} icon={<ClipboardList size={22} />} iconBg="bg-emerald-100 text-emerald-600" />
        <StatCard title="Time Logs" value={data.timeCount} icon={<Clock size={22} />} iconBg="bg-indigo-100 text-indigo-600" />
      </div>
    </div>
  );
}
