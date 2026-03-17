"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Deployment, InternDeployment, PartnerAgency, Profile } from "@/lib/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { calculateExpectedEndDate, formatDate, formatHours } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { assignInternAgency } from "./actions";

type DeploymentRow = Deployment & {
  programs?: { name: string } | null;
};

type EnrollmentRow = InternDeployment & {
  profiles?: Profile | null;
  partner_agencies?: PartnerAgency | null;
};

type AssignmentForm = {
  agencyId: string;
  startDate: string;
  status: InternDeployment["status"];
};

export default function AdminDeploymentDetailPage() {
  const supabase = createClient();
  const params = useParams<{ deploymentId: string }>();
  const deploymentId = params?.deploymentId;

  const [loading, setLoading] = useState(true);
  const [deployment, setDeployment] = useState<DeploymentRow | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [agencies, setAgencies] = useState<PartnerAgency[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentRow | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    agencyId: "",
    startDate: "",
    status: "pending",
  });
  const [agencySearch, setAgencySearch] = useState("");
  const [savingAgency, setSavingAgency] = useState(false);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("");

  const load = useCallback(async () => {
    if (!deploymentId) return;

    setLoading(true);
    const [{ data: deploymentData }, { data: enrollmentData }, { data: agencyData }] = await Promise.all([
      supabase.from("deployments").select("*, programs(name)").eq("id", deploymentId).single(),
      supabase
        .from("intern_deployments")
        .select("*, profiles(*), partner_agencies(*)")
        .eq("deployment_id", deploymentId)
        .order("created_at", { ascending: false }),
      supabase.from("partner_agencies").select("*").order("name", { ascending: true }),
    ]);

    setDeployment((deploymentData as DeploymentRow | null) ?? null);
    setEnrollments((enrollmentData as EnrollmentRow[] | null) ?? []);
    setAgencies((agencyData as PartnerAgency[] | null) ?? []);
    setLoading(false);
  }, [deploymentId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const internsCount = enrollments.length;
  const assignedAgencyCount = useMemo(() => {
    return enrollments.filter((row) => Boolean(row.partner_agencies?.id)).length;
  }, [enrollments]);

  const programOptions = useMemo(() => {
    const programs = Array.from(
      new Set(enrollments.map((row) => row.profiles?.program).filter(Boolean) as string[])
    ).sort((a, b) => a.localeCompare(b));

    return [{ value: "", label: "All Programs" }, ...programs.map((program) => ({ value: program, label: program }))];
  }, [enrollments]);

  const sectionOptions = useMemo(() => {
    const sections = Array.from(
      new Set(enrollments.map((row) => row.profiles?.section).filter(Boolean) as string[])
    ).sort((a, b) => a.localeCompare(b));

    return [{ value: "", label: "All Sections" }, ...sections.map((section) => ({ value: section, label: section }))];
  }, [enrollments]);

  const agencyFilterOptions = useMemo(() => {
    const uniqueAgencies = Array.from(
      new Map(
        enrollments
          .filter((row) => row.partner_agencies)
          .map((row) => [row.partner_agencies!.id, row.partner_agencies!])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));

    return [{ value: "", label: "All Agencies" }, ...uniqueAgencies.map((agency) => ({ value: agency.id, label: agency.name }))];
  }, [enrollments]);

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "withdrawn", label: "Withdrawn" },
  ];

  const agencySuggestions = useMemo(() => agencies.map((agency) => agency.name), [agencies]);

  const computedExpectedEndDate = useMemo(() => {
    if (!selectedEnrollment) return "";

    return (
      calculateExpectedEndDate(
        assignmentForm.startDate || null,
        selectedEnrollment.required_hours,
        selectedEnrollment.rendered_hours,
        selectedEnrollment.profiles?.duty_hours_per_day ?? 8,
        selectedEnrollment.profiles?.duty_days_per_week ?? 5
      ) ?? ""
    );
  }, [assignmentForm.startDate, selectedEnrollment]);

  const filteredEnrollments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrollments.filter((row) => {
      const fullName = (row.profiles?.full_name ?? "").toLowerCase();
      const email = (row.profiles?.email ?? "").toLowerCase();
      const studentId = (row.profiles?.student_id ?? "").toLowerCase();

      const matchesSearch =
        query.length === 0 ||
        fullName.includes(query) ||
        email.includes(query) ||
        studentId.includes(query);

      const matchesProgram = !programFilter || row.profiles?.program === programFilter;
      const matchesSection = !sectionFilter || row.profiles?.section === sectionFilter;
      const matchesAgency = !agencyFilter || row.agency_id === agencyFilter;
      return matchesSearch && matchesProgram && matchesSection && matchesAgency;
    });
  }, [enrollments, search, programFilter, sectionFilter, agencyFilter]);

  function openAssignModal(row: EnrollmentRow) {
    setSelectedEnrollment(row);
    setAssignmentForm({
      agencyId: row.agency_id ?? "",
      startDate: row.start_date ? row.start_date.slice(0, 10) : "",
      status: row.status,
    });
    setAgencySearch(row.partner_agencies?.name ?? "");
    setAssignModalOpen(true);
  }

  async function saveAgencyAssignment() {
    if (!deployment || !selectedEnrollment || !assignmentForm.agencyId) return;

    setSavingAgency(true);
    const result = await assignInternAgency({
      internDeploymentId: selectedEnrollment.id,
      deploymentId: deployment.id,
      agencyId: assignmentForm.agencyId,
      startDate: assignmentForm.startDate || null,
      expectedEndDate: computedExpectedEndDate || null,
      status: assignmentForm.status,
    });

    if (result.error) {
      alert(result.error);
      setSavingAgency(false);
      return;
    }

    setAssignModalOpen(false);
    setSelectedEnrollment(null);
    setAssignmentForm({ agencyId: "", startDate: "", status: "pending" });
    setAgencySearch("");
    await load();
    setSavingAgency(false);
  }

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

        <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or student ID"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Select
            label="Program"
            value={programFilter}
            onChange={(event) => setProgramFilter(event.target.value)}
            options={programOptions}
          />
          <Select
            label="Section"
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value)}
            options={sectionOptions}
          />
          <Select
            label="Agency"
            value={agencyFilter}
            onChange={(event) => setAgencyFilter(event.target.value)}
            options={agencyFilterOptions}
          />
        </div>

        {filteredEnrollments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No interns matched the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Intern</th>
                  <th className="text-left font-medium px-5 py-3">Email</th>
                  <th className="text-left font-medium px-5 py-3">Program</th>
                  <th className="text-left font-medium px-5 py-3">Section</th>
                  <th className="text-left font-medium px-5 py-3">Agency</th>
                  <th className="text-left font-medium px-5 py-3">Address</th>
                  <th className="text-left font-medium px-5 py-3">Hours Rendered</th>
                  <th className="text-left font-medium px-5 py-3">Status</th>
                  <th className="text-left font-medium px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEnrollments.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-slate-800 font-medium">
                      <Link
                        href={`/admin/deployments/${deployment.id}/interns/${row.intern_id}`}
                        className="text-indigo-700 hover:text-indigo-800 hover:underline"
                      >
                        {row.profiles?.full_name ?? "-"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.profiles?.email ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-700">{row.profiles?.program ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-700">{row.profiles?.section ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-700">{row.partner_agencies?.name ?? "Not assigned"}</td>
                    <td className="px-5 py-3 text-slate-700">{row.partner_agencies?.address ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-700">{formatHours(row.rendered_hours)}</td>
                    <td className="px-5 py-3 text-slate-700 capitalize">{row.status}</td>

                    <td className="px-5 py-3 text-slate-700">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={row.agency_id ? "outline" : "primary"}
                          onClick={() => openAssignModal(row)}
                        >
                          {row.agency_id ? "Change" : "Assign"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Agency"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-800">{selectedEnrollment?.profiles?.full_name ?? "Intern"}</p>
            <p>{selectedEnrollment?.profiles?.email ?? ""}</p>
          </div>

          <Input
            label="Agency"
            placeholder="Type agency name"
            value={agencySearch}
            onChange={(event) => {
              const value = event.target.value;
              const matchedAgency = agencies.find((agency) => agency.name === value);
              setAgencySearch(value);
              setAssignmentForm((current) => ({ ...current, agencyId: matchedAgency?.id ?? "" }));
            }}
            list="admin-agency-suggestions"
            helperText="Type to search agency and pick from suggestions."
          />
          <datalist id="admin-agency-suggestions">
            {agencySuggestions.map((agencyName, index) => (
              <option key={`${agencyName}-${index}`} value={agencyName} />
            ))}
          </datalist>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={assignmentForm.startDate}
              onChange={(event) =>
                setAssignmentForm((current) => ({ ...current, startDate: event.target.value }))
              }
            />
            <Input
              label="Estimated End Date"
              type="date"
              value={computedExpectedEndDate}
              disabled
              helperText="Auto-calculated from required/rendered hours and intern duty hours/day."
            />
          </div>

          <Select
            label="Status"
            options={statusOptions}
            value={assignmentForm.status}
            onChange={(event) =>
              setAssignmentForm((current) => ({
                ...current,
                status: event.target.value as InternDeployment["status"],
              }))
            }
          />

          <div className="flex justify-end">
            <Button onClick={saveAgencyAssignment} loading={savingAgency} disabled={!assignmentForm.agencyId}>
              Save Assignment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
