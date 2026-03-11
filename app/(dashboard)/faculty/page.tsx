"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard, Card } from "@/components/ui/Card";
import { Profile } from "@/lib/types";
import { Users, ClipboardList, Clock, MessageSquare } from "lucide-react";

type DeploymentFacultyRow = {
  deployment_id: string;
};

type InternDeploymentIdRow = {
  id: string;
};

type RecentInternRow = {
  profiles: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export default function FacultyDashboard() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    interns: 0,
    dailyRecords: 0,
    timeRecords: 0,
    feedbackCount: 0,
  });
  const [recentInterns, setRecentInterns] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const currentProfile = profile;

    async function load() {
      // Get deployments assigned to faculty
      const { data: depFac } = await supabase
        .from("deployment_faculty")
        .select("deployment_id")
        .eq("faculty_id", currentProfile.id);

      const deploymentIds =
        (depFac as DeploymentFacultyRow[] | null)?.map((d) => d.deployment_id) ?? [];

      if (deploymentIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: internDeploymentIds } = await supabase
        .from("intern_deployments")
        .select("id")
        .in("deployment_id", deploymentIds);

      const scopedInternDeploymentIds =
        (internDeploymentIds as InternDeploymentIdRow[] | null)?.map((d) => d.id) ?? [];

      const [{ count: interns }, { count: dailyRecords }, { count: timeRecords }, { count: feedbackCount }, { data: internDeps }] =
        await Promise.all([
          supabase
            .from("intern_deployments")
            .select("id", { count: "exact", head: true })
            .in("deployment_id", deploymentIds),
          supabase
            .from("daily_records")
            .select("id", { count: "exact", head: true })
            .in("intern_deployment_id", scopedInternDeploymentIds),
          supabase
            .from("time_records")
            .select("id", { count: "exact", head: true })
            .in("intern_deployment_id", scopedInternDeploymentIds),
          supabase
            .from("feedback")
            .select("id", { count: "exact", head: true })
            .eq("faculty_id", currentProfile.id),
          supabase
            .from("intern_deployments")
            .select("profiles(id, full_name, email)")
            .in("deployment_id", deploymentIds)
            .limit(5),
        ]);

      setStats({
        interns: interns ?? 0,
        dailyRecords: dailyRecords ?? 0,
        timeRecords: timeRecords ?? 0,
        feedbackCount: feedbackCount ?? 0,
      });

      setRecentInterns(
        ((internDeps as RecentInternRow[] | null) ?? [])
          .map((row) => row.profiles)
          .filter(Boolean) as { id: string; full_name: string; email: string }[]
      );
      setLoading(false);
    }
    load();
  }, [profile, supabase]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Faculty Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Monitor interns, logs, and feedback</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Assigned Interns" value={stats.interns} icon={<Users size={22} />} iconBg="bg-blue-100 text-blue-600" />
            <StatCard title="Daily Records" value={stats.dailyRecords} icon={<ClipboardList size={22} />} iconBg="bg-emerald-100 text-emerald-600" />
            <StatCard title="Time Logs" value={stats.timeRecords} icon={<Clock size={22} />} iconBg="bg-amber-100 text-amber-600" />
            <StatCard title="Feedback Sent" value={stats.feedbackCount} icon={<MessageSquare size={22} />} iconBg="bg-purple-100 text-purple-600" />
          </div>

          <Card title="Recently Assigned Interns">
            {recentInterns.length === 0 ? (
              <p className="text-slate-400 text-sm">No interns assigned yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentInterns.map((intern) => (
                  <div key={intern.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="font-medium text-slate-900">{intern.full_name}</p>
                    <p className="text-sm text-slate-500">{intern.email}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
