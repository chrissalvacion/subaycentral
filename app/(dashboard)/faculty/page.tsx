"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard, Card } from "@/components/ui/Card";
import { PartnerAgency, Profile } from "@/lib/types";
import { Users, ClipboardList, Clock, MessageSquare, Search } from "lucide-react";

type InternDeploymentIdRow = {
  id: string;
};

type RecentInternRow = {
  profiles: Pick<Profile, "id" | "full_name" | "email"> | null;
};

type AgencySummary = {
  id: string;
  name: string;
  slots: number | null;
  assignedInterns: number;
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
  const [agencySummary, setAgencySummary] = useState<AgencySummary[]>([]);
  const [agencySearch, setAgencySearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const currentProfile = profile;

    async function load() {
      if (!currentProfile.program || !currentProfile.section) {
        setLoading(false);
        return;
      }

      const { data: scopedInternProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "intern")
        .eq("program", currentProfile.program)
        .eq("section", currentProfile.section);

      const { data: agencyList } = await supabase
        .from("partner_agencies")
        .select("id, name, intern_slot_limit")
        .order("name", { ascending: true });

      const { data: overallInternDeployments } = await supabase
        .from("intern_deployments")
        .select("agency_id");

      const assignedByAgency: Record<string, number> = {};
      for (const row of (overallInternDeployments as { agency_id: string | null }[] | null) ?? []) {
        if (!row.agency_id) continue;
        assignedByAgency[row.agency_id] = (assignedByAgency[row.agency_id] ?? 0) + 1;
      }

      const internIds =
        (scopedInternProfiles as { id: string }[] | null)?.map((intern) => intern.id) ?? [];

      if (internIds.length === 0) {
        setStats({ interns: 0, dailyRecords: 0, timeRecords: 0, feedbackCount: 0 });
        setRecentInterns([]);
        const agencies = (agencyList as Pick<PartnerAgency, "id" | "name" | "intern_slot_limit">[] | null) ?? [];
        setAgencySummary(
          agencies.map((agency) => ({
            id: agency.id,
            name: agency.name,
            slots: agency.intern_slot_limit,
            assignedInterns: assignedByAgency[agency.id] ?? 0,
          }))
        );
        setLoading(false);
        return;
      }

      const { data: allScopedInternDeployments } = await supabase
        .from("intern_deployments")
        .select("id, agency_id")
        .in("intern_id", internIds);

      const scopedInternDeploymentIds =
        (allScopedInternDeployments as (InternDeploymentIdRow & { agency_id: string | null })[] | null)?.map((d) => d.id) ?? [];

      const agencies = (agencyList as Pick<PartnerAgency, "id" | "name" | "intern_slot_limit">[] | null) ?? [];
      setAgencySummary(
        agencies.map((agency) => ({
          id: agency.id,
          name: agency.name,
          slots: agency.intern_slot_limit,
          assignedInterns: assignedByAgency[agency.id] ?? 0,
        }))
      );

      const [{ count: interns }, { count: dailyRecords }, { count: timeRecords }, { count: feedbackCount }, { data: internDeps }] =
        await Promise.all([
          supabase
            .from("intern_deployments")
            .select("id", { count: "exact", head: true })
            .in("intern_id", internIds),
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
            .in("intern_id", internIds)
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

  const filteredAgencySummary = useMemo(() => {
    const q = agencySearch.trim().toLowerCase();
    if (!q) return agencySummary;
    return agencySummary.filter((agency) => agency.name.toLowerCase().includes(q));
  }, [agencySummary, agencySearch]);

  const totalRemainingSlots = useMemo(() => {
    return filteredAgencySummary.reduce((sum, agency) => {
      if (agency.slots == null) return sum;
      return sum + Math.max(0, agency.slots - agency.assignedInterns);
    }, 0);
  }, [filteredAgencySummary]);

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

          <Card title="Agencies, Slots, and Assigned Interns">
            <div className="space-y-3">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Total Remaining Slots:</span> {totalRemainingSlots}
              </div>

              <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={agencySearch}
                  onChange={(event) => setAgencySearch(event.target.value)}
                  placeholder="Search agency..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {filteredAgencySummary.length === 0 ? (
              <p className="text-slate-400 text-sm">No agencies found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">Agency</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">Slots</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">Total Assigned Intern</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">Remaining Slots</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredAgencySummary.map((agency) => (
                      <tr key={agency.id}>
                        <td className="px-3 py-2 text-slate-800 font-medium">{agency.name}</td>
                        <td className="px-3 py-2 text-slate-600">{agency.slots ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{agency.assignedInterns}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {agency.slots == null ? "-" : Math.max(0, agency.slots - agency.assignedInterns)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

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
