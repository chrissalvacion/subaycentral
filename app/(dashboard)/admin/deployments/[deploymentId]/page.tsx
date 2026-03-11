"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Deployment, InternDeployment, PartnerAgency, Profile } from "@/lib/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";

type DeploymentRow = Deployment & {
  programs?: { name: string } | null;
};

type EnrollmentRow = InternDeployment & {
  profiles?: Profile | null;
  partner_agencies?: PartnerAgency | null;
};

export default function AdminDeploymentDetailPage() {
  const supabase = createClient();
  const params = useParams<{ deploymentId: string }>();
  const deploymentId = params?.deploymentId;

  const [loading, setLoading] = useState(true);
  const [deployment, setDeployment] = useState<DeploymentRow | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);

  const load = useCallback(async () => {
    if (!deploymentId) return;

    setLoading(true);
    const [{ data: deploymentData }, { data: enrollmentData }] = await Promise.all([
      supabase.from("deployments").select("*, programs(name)").eq("id", deploymentId).single(),
      supabase
        .from("intern_deployments")
        .select("*, profiles(*), partner_agencies(*)")
        .eq("deployment_id", deploymentId)
        .order("created_at", { ascending: false }),
    ]);

    setDeployment((deploymentData as DeploymentRow | null) ?? null);
    setEnrollments((enrollmentData as EnrollmentRow[] | null) ?? []);
    setLoading(false);
  }, [deploymentId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const internsCount = enrollments.length;
  const assignedAgencyCount = useMemo(() => {
    return enrollments.filter((row) => Boolean(row.partner_agencies?.id)).length;
  }, [enrollments]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-4">
        <Link href="/admin/deployments" className="text-sm text-indigo-700 hover:underline">
          Back to Deployments
        </Link>
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Deployment not found</h1>
          <p className="text-sm text-slate-500 mt-1">The selected deployment does not exist or is no longer available.</p>
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
          <span className="text-slate-700 font-medium">{deployment.name}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h1 className="text-2xl font-bold text-slate-900">Deployment Details</h1>
          <p className="text-sm text-slate-500 mt-1">
            {deployment.programs?.name ?? "No program"} • {deployment.required_hours} required hours
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-slate-400">School Year</p>
              <p className="font-medium text-slate-700">{deployment.school_year ?? "-"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-slate-400">Semester</p>
              <p className="font-medium text-slate-700">{deployment.semester ?? "-"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-slate-400">Start</p>
              <p className="font-medium text-slate-700">{formatDate(deployment.start_date)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-slate-400">End</p>
              <p className="font-medium text-slate-700">{formatDate(deployment.end_date)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">Deployed Interns</h2>
            <p className="text-sm text-slate-500">
              {internsCount} intern(s), {assignedAgencyCount} with assigned agency
            </p>
          </div>
        </div>

        {enrollments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No interns are deployed in this deployment yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Intern</th>
                  <th className="text-left font-medium px-5 py-3">Email</th>
                  <th className="text-left font-medium px-5 py-3">Agency</th>
                  <th className="text-left font-medium px-5 py-3">Address</th>
                  <th className="text-left font-medium px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-slate-800 font-medium">{row.profiles?.full_name ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-700">{row.profiles?.email ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-700">{row.partner_agencies?.name ?? "Not assigned"}</td>
                    <td className="px-5 py-3 text-slate-700">{row.partner_agencies?.address ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-700 capitalize">{row.status}</td>
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
