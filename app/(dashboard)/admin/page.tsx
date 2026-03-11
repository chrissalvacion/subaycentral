"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/Card";
import { Users, BookOpen, Building2, ClipboardList } from "lucide-react";

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

  useEffect(() => {
    async function load() {
      const [
        { count: faculty },
        { count: interns },
        { count: programs },
        { count: agencies },
        { count: deployments },
        { count: activeDeployments },
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
      ]);

      setStats({
        faculty: faculty ?? 0,
        interns: interns ?? 0,
        programs: programs ?? 0,
        agencies: agencies ?? 0,
        deployments: deployments ?? 0,
        activeDeployments: activeDeployments ?? 0,
      });
      setLoading(false);
    }
    load();
  }, [supabase]);

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
    </div>
  );
}
