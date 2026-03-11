"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, StatCard } from "@/components/ui/Card";
import { PartnerAgency } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Users, BookOpen, Building2, ClipboardList, Search } from "lucide-react";

type AgencySummary = {
  id: string;
  name: string;
  slots: number | null;
  assignedInterns: number;
};

type RecentActivity = {
  id: string;
  created_at: string;
  status: string;
  profiles: { full_name?: string } | null;
  partner_agencies: { name?: string } | null;
};

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    faculty: 0,
    interns: 0,
    programs: 0,
    agencies: 0,
    deployments: 0,
    activeDeployments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [agencySummary, setAgencySummary] = useState<AgencySummary[]>([]);
  const [agencySearch, setAgencySearch] = useState("");
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    async function load() {
      const [
        { count: faculty },
        { count: interns },
        { count: programs },
        { count: agenciesCount },
        { count: deployments },
        { count: activeDeployments },
        { data: agencyList },
        { data: internDeployments },
        { data: activityRows },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "faculty"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "intern"),
        supabase.from("programs").select("id", { count: "exact", head: true }),
        supabase
          .from("partner_agencies")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("deployments")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("deployments")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.from("partner_agencies").select("id, name, intern_slot_limit"),
        supabase.from("intern_deployments").select("agency_id"),
        supabase
          .from("intern_deployments")
          .select("id, created_at, status, profiles(full_name), partner_agencies(name)")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const assignedByAgency: Record<string, number> = {};
      for (const row of (internDeployments as { agency_id: string | null }[] | null) ?? []) {
        if (!row.agency_id) continue;
        assignedByAgency[row.agency_id] = (assignedByAgency[row.agency_id] ?? 0) + 1;
      }

      const agencies = (agencyList as Pick<PartnerAgency, "id" | "name" | "intern_slot_limit">[] | null) ?? [];
      setAgencySummary(
        agencies.map((agency) => ({
          id: agency.id,
          name: agency.name,
          slots: agency.intern_slot_limit,
          assignedInterns: assignedByAgency[agency.id] ?? 0,
        }))
      );
      setRecentActivities((activityRows as RecentActivity[] | null) ?? []);

      setStats({
        faculty: faculty ?? 0,
        interns: interns ?? 0,
        programs: programs ?? 0,
        agencies: agenciesCount ?? 0,
        deployments: deployments ?? 0,
        activeDeployments: activeDeployments ?? 0,
      });
      setLoading(false);
    }
    load();
  }, [supabase]);

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
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          System overview and quick statistics
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-white rounded-xl border border-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Faculty Members"
            value={stats.faculty}
            icon={<Users size={22} />}
            iconBg="bg-purple-100 text-purple-600"
          />
          <StatCard
            title="Interns"
            value={stats.interns}
            icon={<Users size={22} />}
            iconBg="bg-blue-100 text-blue-600"
          />
          <StatCard
            title="Programs"
            value={stats.programs}
            icon={<BookOpen size={22} />}
            iconBg="bg-emerald-100 text-emerald-600"
          />
          <StatCard
            title="Partner Agencies"
            value={stats.agencies}
            icon={<Building2 size={22} />}
            iconBg="bg-amber-100 text-amber-600"
          />
          <StatCard
            title="Total Deployments"
            value={stats.deployments}
            icon={<ClipboardList size={22} />}
            iconBg="bg-indigo-100 text-indigo-600"
          />
          <StatCard
            title="Active Deployments"
            value={stats.activeDeployments}
            icon={<ClipboardList size={22} />}
            iconBg="bg-green-100 text-green-600"
          />
        </div>
      )}

      <Card title="Agencies, Slots, and Assigned Interns">
        <div className="space-y-3 mb-3">
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
          <div className="space-y-4 mt-2">
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
          </div>
        )}
      </Card>

      <Card title="Recent Intern Deployment Activities">
        {recentActivities.length === 0 ? (
          <p className="text-slate-400 text-sm">No recent activities.</p>
        ) : (
          <div className="space-y-4 mt-2">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="p-3 bg-white rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {activity.profiles?.full_name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div>
                    <p className="text-sm text-slate-800">{activity.profiles?.full_name ?? "Unknown Intern"}</p>
                    <p className="text-xs text-slate-500">{formatDate(activity.created_at)}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {activity.status === "assigned" && (
                    <>Assigned to <span className="font-medium">{activity.partner_agencies?.name ?? "an agency"}</span></>
                  )}
                  {activity.status === "completed" && <>Completed deployment at <span className="font-medium">{activity.partner_agencies?.name ?? "an agency"}</span></>}
                  {activity.status === "upcoming" && <>Upcoming deployment at <span className="font-medium">{activity.partner_agencies?.name ?? "an agency"}</span></>}   
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>



    </div>
  );
}
