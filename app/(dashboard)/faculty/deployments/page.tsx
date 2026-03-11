"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Deployment, InternDeployment, PartnerAgency, Profile } from "@/lib/types";
import { DeploymentStatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type DeploymentRow = Deployment & {
  programs?: { name: string } | null;
};

type InternDeploymentRow = InternDeployment & {
  profiles?: Profile | null;
  deployments?: Deployment | null;
  partner_agencies?: PartnerAgency | null;
};

export default function FacultyDeploymentsPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [internCounts, setInternCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      if (!profile) return;

      setLoading(true);

      if (!profile.program || !profile.section) {
        setDeployments([]);
        setInternCounts({});
        setLoading(false);
        return;
      }

      const [
        { data: allDeployments },
        { data: allInternDeployments },
      ] = await Promise.all([
        supabase
          .from("deployments")
          .select("*, programs(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("intern_deployments")
          .select("*, profiles(*), deployments(*), partner_agencies(*)"),
      ]);

      const scopedDeployments = ((allDeployments as DeploymentRow[] | null) ?? []).filter(
        (deployment) => deployment.programs?.name === profile.program
      );

      const { data: allInterns } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "intern")
        .eq("program", profile.program)
        .eq("section", profile.section);
      const internIdsOnly = ((allInterns as { id: string }[] | null) ?? []).map((intern) => intern.id);
      const scopedInternIds = new Set(internIdsOnly);
      const scopedDeploymentIds = new Set(scopedDeployments.map((deployment) => deployment.id));

      const scopedInternDeployments = ((allInternDeployments as InternDeploymentRow[] | null) ?? []).filter(
        (internDeployment) =>
          scopedInternIds.has(internDeployment.intern_id) &&
          scopedDeploymentIds.has(internDeployment.deployment_id)
      );

      const countByDeployment: Record<string, number> = {};
      for (const internDeployment of scopedInternDeployments) {
        countByDeployment[internDeployment.deployment_id] =
          (countByDeployment[internDeployment.deployment_id] ?? 0) + 1;
      }

      setDeployments(scopedDeployments);
      setInternCounts(countByDeployment);
      setLoading(false);
    }

    load();
  }, [profile, supabase]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Deployment Management</h1>
        <p className="text-slate-500 text-sm">
          Deployments for {profile?.program ?? "your program"} and your section interns
        </p>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : deployments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
          No deployments available for your assigned program.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Deployment</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Program</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">School Year / Semester</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Dates</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">My Section Interns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deployments.map((deployment) => (
                  <tr key={deployment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        href={`/faculty/deployments/${deployment.id}`}
                        className="text-indigo-700 hover:text-indigo-800 hover:underline"
                      >
                        {deployment.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{deployment.programs?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {(deployment.school_year ?? "-") + " / " + (deployment.semester ?? "-")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(deployment.start_date)} - {formatDate(deployment.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      <DeploymentStatusBadge status={deployment.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {internCounts[deployment.id] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
