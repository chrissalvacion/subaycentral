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
  dailyRenderedHours: { date: string; hours: number }[];
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
          .select("date, total_hours")
          .eq("intern_deployment_id", deployment.id),
      ]);

      const timeRecords = (timeRecordsResult.data as { date: string; total_hours: number | null }[] | null) ?? [];
      const renderedHours = Number(
        timeRecords
          .reduce((sum: number, record) => sum + Number(record.total_hours ?? 0), 0)
          .toFixed(2)
      );

      const dailyMap = new Map<string, number>();
      for (const record of timeRecords) {
        const current = dailyMap.get(record.date) ?? 0;
        dailyMap.set(record.date, Number((current + Number(record.total_hours ?? 0)).toFixed(2)));
      }
      const dailyRenderedHours = Array.from(dailyMap.entries())
        .map(([date, hours]) => ({ date, hours }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const requiredHours = deployment.required_hours ?? deployment.deployments?.required_hours ?? 0;
      const computedExpectedEndDate = calculateExpectedEndDate(
        deployment.start_date,
        requiredHours,
        renderedHours,
        currentProfile.duty_hours_per_day ?? 8,
        currentProfile.duty_days_per_week ?? 5
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
        dailyRenderedHours,
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
  const chartWidth = 760;
  const chartHeight = 260;
  const chartPadding = 32;
  const maxHours = Math.max(1, ...data.dailyRenderedHours.map((point) => point.hours));
  const linePoints = data.dailyRenderedHours.map((point, index, list) => {
    const x = chartPadding + (index * (chartWidth - chartPadding * 2)) / Math.max(1, list.length - 1);
    const y = chartHeight - chartPadding - (point.hours / maxHours) * (chartHeight - chartPadding * 2);
    return { ...point, x, y };
  });
  const linePath = linePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");

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

      <Card>
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Rendered Hours Fluctuation</h3>
            <p className="text-sm text-slate-500">Daily total rendered hours based on your time logs</p>
          </div>

          {data.dailyRenderedHours.length === 0 ? (
            <p className="text-sm text-slate-400">No time logs available for chart display yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full min-w-[700px]"
                role="img"
                aria-label="Daily rendered hours chart"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                  const y = chartHeight - chartPadding - tick * (chartHeight - chartPadding * 2);
                  return (
                    <g key={tick}>
                      <line x1={chartPadding} y1={y} x2={chartWidth - chartPadding} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                      <text x={8} y={y + 4} fontSize="11" fill="#64748b">
                        {(maxHours * tick).toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                <line
                  x1={chartPadding}
                  y1={chartHeight - chartPadding}
                  x2={chartWidth - chartPadding}
                  y2={chartHeight - chartPadding}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />

                {linePath ? <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2.5" /> : null}

                {linePoints.map((point) => (
                  <g key={point.date}>
                    <circle cx={point.x} cy={point.y} r="3.5" fill="#4f46e5" />
                    <title>{`${formatDate(point.date)}: ${point.hours} hour(s)`}</title>
                  </g>
                ))}

                <text x={chartPadding} y={chartHeight - 8} fontSize="11" fill="#64748b">
                  {formatDate(data.dailyRenderedHours[0].date)}
                </text>
                <text x={chartWidth - chartPadding} y={chartHeight - 8} fontSize="11" textAnchor="end" fill="#64748b">
                  {formatDate(data.dailyRenderedHours[data.dailyRenderedHours.length - 1].date)}
                </text>
              </svg>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Accumulated Rendered Hours" value={formatHours(data.renderedHours)} icon={<Clock size={22} />} iconBg="bg-amber-100 text-amber-600" />
        <StatCard title="Required Hours" value={formatHours(data.requiredHours)} icon={<Clock size={22} />} iconBg="bg-blue-100 text-blue-600" />
        <StatCard title="Daily Records" value={data.dailyCount} icon={<ClipboardList size={22} />} iconBg="bg-emerald-100 text-emerald-600" />
        <StatCard title="Time Logs" value={data.timeCount} icon={<Clock size={22} />} iconBg="bg-indigo-100 text-indigo-600" />
      </div>

      
    </div>
  );
}
