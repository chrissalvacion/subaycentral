"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Profile, InternDeployment, PartnerAgency } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { InternStatusBadge } from "@/components/ui/Badge";
import { calculateExpectedEndDate, formatDate, formatHours } from "@/lib/utils";
import { Search, Eye, Pencil } from "lucide-react";

type InternDeploymentRow = InternDeployment & {
  profiles?: Profile;
  partner_agencies?: PartnerAgency;
};

type InternRow = {
  intern: Profile;
  deployment: InternDeploymentRow | null;
};

type EditDeploymentForm = {
  agencyId: string;
  startDate: string;
  status: string;
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

export default function FacultyInternsPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [interns, setInterns] = useState<InternRow[]>([]);
  const [agencies, setAgencies] = useState<PartnerAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingIntern, setEditingIntern] = useState<InternRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editAgencySearch, setEditAgencySearch] = useState("");
  const [editForm, setEditForm] = useState<EditDeploymentForm>({
    agencyId: "",
    startDate: "",
    status: "pending",
  });

  const load = useCallback(async () => {
    if (!profile) return;
    const currentProfile = profile;
    setLoading(true);

    if (!currentProfile.program || !currentProfile.section) {
      setInterns([]);
      setLoading(false);
      return;
    }

    const [{ data: internProfiles }, { data: facultyDeployments }, { data: agencyList }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "intern")
        .order("full_name", { ascending: true }),
      supabase
        .from("deployment_faculty")
        .select("deployment_id")
        .eq("faculty_id", currentProfile.id),
      supabase.from("partner_agencies").select("*").order("name"),
    ]);

    const facultyProgram = normalizeProgram(currentProfile.program);
    const facultySection = normalizeValue(currentProfile.section);

    const scopedProfiles = ((internProfiles as Profile[]) ?? []).filter((intern) => {
      return (
        normalizeProgram(intern.program) === facultyProgram &&
        normalizeValue(intern.section) === facultySection
      );
    });
    const scopedInternIds = scopedProfiles.map((intern) => intern.id);

    if (scopedInternIds.length === 0) {
      setInterns([]);
      setAgencies((agencyList as PartnerAgency[]) ?? []);
      setLoading(false);
      return;
    }

    const assignedDeploymentIds = Array.from(
      new Set(((facultyDeployments as { deployment_id: string }[] | null) ?? []).map((item) => item.deployment_id))
    );

    const { data: internDeps } = await supabase
      .from("intern_deployments")
      .select("*, profiles(*), partner_agencies(*)")
      .in("intern_id", scopedInternIds)
      .order("created_at", { ascending: false });

    const scopedDeployments = ((internDeps as InternDeploymentRow[]) ?? []).filter((deployment) => {
      const matchesProgramSection =
        deployment.profiles?.role === "intern" &&
        normalizeProgram(deployment.profiles?.program) === facultyProgram &&
        normalizeValue(deployment.profiles?.section) === facultySection;

      if (!matchesProgramSection) return false;

      // If this faculty has explicit deployment assignments, scope to those deployments.
      if (assignedDeploymentIds.length > 0) {
        return assignedDeploymentIds.includes(deployment.deployment_id);
      }

      // Fallback: show interns in the same program/section even without assignment rows.
      return true;
    });

    const latestDeploymentByIntern = new Map<string, InternDeploymentRow>();
    for (const deployment of scopedDeployments) {
      if (!latestDeploymentByIntern.has(deployment.intern_id)) {
        latestDeploymentByIntern.set(deployment.intern_id, deployment);
      }
    }

    const rows: InternRow[] = scopedProfiles.map((intern) => ({
        intern,
        deployment: latestDeploymentByIntern.get(intern.id) ?? null,
      }));

    setInterns(rows);
    setAgencies((agencyList as PartnerAgency[]) ?? []);
    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => { load(); }, [load]);

  function openEditDeployment(row: InternRow) {
    if (!row.deployment) {
      alert("This intern has no deployment record yet.");
      return;
    }

    setEditingIntern(row);
    setEditAgencySearch(row.deployment.partner_agencies?.name ?? "");
    setEditForm({
      agencyId: row.deployment.agency_id ?? "",
      startDate: row.deployment.start_date ? row.deployment.start_date.slice(0, 10) : "",
      status: row.deployment.status,
    });
    setEditOpen(true);
  }

  async function saveDeploymentDetails() {
    if (!editingIntern?.deployment) return;
    setSavingEdit(true);

    const dutyHoursPerDay = editingIntern.intern.duty_hours_per_day ?? 8;
    const expectedEndDate = calculateExpectedEndDate(
      editForm.startDate || null,
      editingIntern.deployment.required_hours,
      editingIntern.deployment.rendered_hours,
      dutyHoursPerDay,
      editingIntern.intern.duty_days_per_week ?? 5
    );

    const { error } = await supabase
      .from("intern_deployments")
      .update({
        agency_id: editForm.agencyId || null,
        start_date: editForm.startDate || null,
        expected_end_date: expectedEndDate,
        status: editForm.status as InternDeployment["status"],
      })
      .eq("id", editingIntern.deployment.id);

    if (error) {
      alert(error.message);
      setSavingEdit(false);
      return;
    }

    setEditOpen(false);
    setEditingIntern(null);
    setSavingEdit(false);
    await load();
  }

  const filtered = interns.filter((row) => {
    const q = search.toLowerCase();
    return (
      row.intern.full_name?.toLowerCase().includes(q) ||
      row.intern.email?.toLowerCase().includes(q)
    );
  });

  const agencyOptions = [
    { value: "", label: "Unassigned" },
    ...agencies.map((a) => ({ value: a.id, label: a.name })),
  ];

  const editAgencySuggestions = agencies
    .filter((agency) =>
      agency.name.toLowerCase().includes(editAgencySearch.trim().toLowerCase())
    )
    .map((agency) => agency.name);

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "withdrawn", label: "Withdrawn" },
  ];

  const computedExpectedEndDate = useMemo(() => {
    if (!editingIntern?.deployment) return "";
    return (
      calculateExpectedEndDate(
        editForm.startDate || null,
        editingIntern.deployment.required_hours,
        editingIntern.deployment.rendered_hours,
        editingIntern.intern.duty_hours_per_day ?? 8,
        editingIntern.intern.duty_days_per_week ?? 5
      ) ?? ""
    );
  }, [editForm.startDate, editingIntern]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Interns</h1>
        <p className="text-slate-500 text-sm">All interns in your assigned program and section</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search interns…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No interns found for your program and section.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Intern</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Agency</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Agency Address</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Start / End</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[220px]">Progress</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((row) => (
                  <tr key={row.intern.id} className="hover:bg-slate-50 transition-colors align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.intern.full_name}</p>
                      <p className="text-slate-500 text-xs">{row.intern.email}</p>
                    </td>
                    <td className="px-4 py-3 min-w-[220px] text-slate-600">
                      {row.deployment?.partner_agencies?.name ?? "No agency"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {row.deployment?.partner_agencies?.address ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      <div>{formatDate(row.deployment?.start_date ?? null)}</div>
                      <div>{formatDate(row.deployment?.expected_end_date ?? null)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.deployment ? (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-600">
                            {formatHours(row.deployment.rendered_hours)} / {formatHours(row.deployment.required_hours ?? 0)}
                          </p>
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    row.deployment.required_hours && row.deployment.required_hours > 0
                                      ? (row.deployment.rendered_hours / row.deployment.required_hours) * 100
                                      : 0
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.deployment ? (
                        <InternStatusBadge status={row.deployment.status} />
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600">
                          No Deployment
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil size={14} />}
                          onClick={() => openEditDeployment(row)}
                          disabled={!row.deployment}
                          title="Edit deployment"
                          aria-label="Edit deployment"
                        >
                        </Button>
                        <Link href={`/faculty/interns/${row.intern.id}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Eye size={14} />}
                            title="View intern details"
                            aria-label="View intern details"
                          />
                        </Link>
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
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editingIntern ? `Edit Deployment - ${editingIntern.intern.full_name}` : "Edit Deployment"}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <Input
            label="Agency"
            placeholder="Type agency name"
            value={editAgencySearch}
            onChange={(event) => {
              const value = event.target.value;
              const matchedAgency = agencies.find((agency) => agency.name === value);
              setEditAgencySearch(value);
              setEditForm((current) => ({ ...current, agencyId: matchedAgency?.id ?? "" }));
            }}
            list="edit-agency-suggestions"
            helperText="Type to search agency and pick from suggestions."
          />
          <datalist id="edit-agency-suggestions">
            {editAgencySuggestions.map((agencyName, index) => (
              <option key={`${agencyName}-${index}`} value={agencyName} />
            ))}
          </datalist>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={editForm.startDate}
              onChange={(event) => setEditForm((current) => ({ ...current, startDate: event.target.value }))}
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
            value={editForm.status}
            onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
          />

          <div className="flex justify-end">
            <Button onClick={saveDeploymentDetails} loading={savingEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
