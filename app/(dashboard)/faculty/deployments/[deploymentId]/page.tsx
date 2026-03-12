"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, PlusCircle, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Deployment, InternDeployment, PartnerAgency, Profile } from "@/lib/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Select } from "@/components/ui/Select";
import { calculateExpectedEndDate, formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { enrollAssignedIntern } from "./actions";

type EnrollmentRow = InternDeployment & {
  profiles?: Profile | null;
  partner_agencies?: PartnerAgency | null;
};

type DeploymentRow = Deployment & {
  programs?: { name: string } | null;
};

type EnrollmentForm = {
  internId: string;
  agencyId: string;
  startDate: string;
};

function normalizeValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeProgram(value: string | null | undefined) {
  const normalized = normalizeValue(value);
  if (normalized === "bsit" || normalized === "bs information technology") {
    return "bs information technology";
  }
  if (normalized === "bsis" || normalized === "bs information systems") {
    return "bs information systems";
  }
  return normalized;
}

export default function FacultyDeploymentDetailPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const params = useParams<{ deploymentId: string }>();
  const deploymentId = params?.deploymentId;

  const [loading, setLoading] = useState(true);
  const [deployment, setDeployment] = useState<DeploymentRow | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [agencies, setAgencies] = useState<PartnerAgency[]>([]);
  const [assignedInterns, setAssignedInterns] = useState<Profile[]>([]);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentForm>({
    internId: "",
    agencyId: "",
    startDate: "",
  });
  const [internSearch, setInternSearch] = useState("");

  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    if (!deploymentId) return;
    setLoading(true);

    const [{ data: deploymentData }, { data: enrollmentData }, { data: agencyData }] = await Promise.all([
      supabase
        .from("deployments")
        .select("*, programs(name)")
        .eq("id", deploymentId)
        .single(),
      supabase
        .from("intern_deployments")
        .select("*, profiles(*), partner_agencies(*)")
        .eq("deployment_id", deploymentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("partner_agencies")
        .select("*")
        .order("name", { ascending: true }),
    ]);

    setDeployment((deploymentData as DeploymentRow | null) ?? null);
    setEnrollments((enrollmentData as EnrollmentRow[] | null) ?? []);
    setAgencies((agencyData as PartnerAgency[] | null) ?? []);
    setLoading(false);
  }, [deploymentId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    async function loadAssignedInterns() {
      if (!profile?.program || !profile?.section) {
        setAssignedInterns([]);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "intern")
        .order("full_name", { ascending: true });

      const facultyProgram = normalizeProgram(profile.program);
      const facultySection = normalizeValue(profile.section);
      const scoped = ((data as Profile[] | null) ?? []).filter((intern) => {
        return (
          normalizeProgram(intern.program) === facultyProgram &&
          normalizeValue(intern.section) === facultySection
        );
      });

      setAssignedInterns(scoped);
    }

    loadAssignedInterns();
  }, [profile, supabase]);

  function openEnrollModal() {
    const today = new Date().toISOString().slice(0, 10);
    setInternSearch("");
    setEnrollmentForm({
      internId: "",
      agencyId: "",
      startDate: today,
    });
    setEnrollModalOpen(true);
  }

  function onTypeIntern(value: string) {
    setInternSearch(value);
    const matched = unassignedInterns.find(
      (intern) => `${intern.full_name} (${intern.email})` === value
    );
    setEnrollmentForm((current) => ({ ...current, internId: matched?.id ?? "" }));
  }

  async function saveEnrollment() {
    if (!deployment) return;
    if (!enrollmentForm.internId || !enrollmentForm.agencyId || !enrollmentForm.startDate) {
      alert("Please select a student, agency, and start date.");
      return;
    }

    setSavingEnrollment(true);
    const existing = enrollments.find((item) => item.intern_id === enrollmentForm.internId);

    if (existing) {
      alert("This intern is already enrolled in this deployment.");
      setSavingEnrollment(false);
      return;
    }

    const selectedIntern = assignedInterns.find((intern) => intern.id === enrollmentForm.internId);
    const dutyHoursPerDay = selectedIntern?.duty_hours_per_day ?? 8;
    const expectedEndDate = calculateExpectedEndDate(
      enrollmentForm.startDate,
      deployment.required_hours,
      0,
      dutyHoursPerDay
    );

    const result = await enrollAssignedIntern({
      deploymentId: deployment.id,
      internId: enrollmentForm.internId,
      agencyId: enrollmentForm.agencyId,
      startDate: enrollmentForm.startDate,
      expectedEndDate,
    });

    if (result.error) {
      alert(result.error);
      setSavingEnrollment(false);
      return;
    }

    setEnrollModalOpen(false);
    await load();
    setSavingEnrollment(false);
  }

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

  const agencyOptions = useMemo(() => {
    const agencies = Array.from(
      new Map(
        enrollments
          .filter((row) => row.partner_agencies)
          .map((row) => [row.partner_agencies!.id, row.partner_agencies!])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));

    return [{ value: "", label: "All Agencies" }, ...agencies.map((agency) => ({ value: agency.id, label: agency.name }))];
  }, [enrollments]);

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(enrollments.map((row) => row.status))).sort((a, b) =>
      a.localeCompare(b)
    );

    return [
      { value: "", label: "All Statuses" },
      ...statuses.map((status) => ({ value: status, label: status.charAt(0).toUpperCase() + status.slice(1) })),
    ];
  }, [enrollments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return enrollments.filter((row) => {
      const intern = row.profiles;
      if (!intern) return false;

      const matchesSearch =
        q.length === 0 ||
        (intern.full_name ?? "").toLowerCase().includes(q) ||
        (intern.email ?? "").toLowerCase().includes(q) ||
        (intern.student_id ?? "").toLowerCase().includes(q);

      const matchesProgram = !programFilter || intern.program === programFilter;
      const matchesSection = !sectionFilter || intern.section === sectionFilter;
      const matchesAgency = !agencyFilter || row.agency_id === agencyFilter;
      const matchesStatus = !statusFilter || row.status === statusFilter;

      return matchesSearch && matchesProgram && matchesSection && matchesAgency && matchesStatus;
    });
  }, [enrollments, search, programFilter, sectionFilter, agencyFilter, statusFilter]);

  const enrolledInternIds = useMemo(
    () => new Set(enrollments.map((item) => item.intern_id)),
    [enrollments]
  );

  const unassignedInterns = useMemo(
    () => assignedInterns.filter((intern) => !enrolledInternIds.has(intern.id)),
    [assignedInterns, enrolledInternIds]
  );

  const internOptions = useMemo(() => {
    const q = internSearch.trim().toLowerCase();
    return unassignedInterns
      .filter((intern) => {
        if (!q) return true;
        return (
          (intern.full_name ?? "").toLowerCase().includes(q) ||
          (intern.email ?? "").toLowerCase().includes(q) ||
          (intern.student_id ?? "").toLowerCase().includes(q)
        );
      })
      .map((intern) => ({
      value: intern.id,
      label: `${intern.full_name} (${intern.email})`,
    }));
  }, [unassignedInterns, internSearch]);

  const assignAgencyOptions = useMemo(() => {
    return agencies.map((agency) => ({
      value: agency.id,
      label: agency.name,
    }));
  }, [agencies]);

  const noUnassignedInterns = unassignedInterns.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/faculty/deployments" className="hover:text-indigo-700 hover:underline">
            Deployments
          </Link>
          <ChevronRight size={14} />
          <span className="text-slate-700 font-medium">{deployment?.name ?? "Details"}</span>
        </div>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Industry Deployment Students</h1>
            <p className="text-sm text-slate-500">
              {deployment ? deployment.name : "Deployment"} - enrolled students regardless of program and section
            </p>
          </div>
          <Button icon={<PlusCircle size={14} />} onClick={openEnrollModal}>
            Enroll Assigned Student
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or student ID"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
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
            options={agencyOptions}
          />
          <Select
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={statusOptions}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No enrolled students matched your search and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Student</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Program</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Section</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Agency</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Start Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Expected End</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.profiles?.full_name ?? "-"}</p>
                      <p className="text-xs text-slate-500">{row.profiles?.email ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.profiles?.program ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.profiles?.section ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.partner_agencies?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.start_date)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.expected_end_date)}</td>
                    <td className="px-4 py-3 text-slate-700 capitalize">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title={deployment ? `Enroll Student - ${deployment.name}` : "Enroll Student"}
        maxWidth="lg"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-500">
            Enroll students assigned to your faculty section into this deployment.
          </p>

          <div className="space-y-4">
            <Input
              label="Intern"
              value={internSearch}
              onChange={(event) => onTypeIntern(event.target.value)}
              placeholder="Type intern name, email, or student ID"
              list="intern-suggestions"
              disabled={noUnassignedInterns}
            />
            <datalist id="intern-suggestions">
              {internOptions.map((option, index) => (
                <option key={`${option.value}-${index}`} value={option.label} />
              ))}
            </datalist>
            <p className="text-xs text-slate-500 -mt-2">
              {noUnassignedInterns
                ? "No available interns to enroll right now."
                : "Type to search. Suggestions show only your assigned interns by program and section."}
            </p>

            <Select
              label="Agency"
              value={enrollmentForm.agencyId}
              onChange={(event) =>
                setEnrollmentForm((current) => ({ ...current, agencyId: event.target.value }))
              }
              options={[{ value: "", label: "Select agency" }, ...assignAgencyOptions]}
            />
            <p className="text-xs text-slate-500 -mt-2">Select the agency where the intern will be deployed.</p>

            <Input
              label="Start Date"
              type="date"
              value={enrollmentForm.startDate}
              onChange={(event) =>
                setEnrollmentForm((current) => ({ ...current, startDate: event.target.value }))
              }
              required
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={saveEnrollment} loading={savingEnrollment} disabled={noUnassignedInterns}>
              Save Enrollment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
