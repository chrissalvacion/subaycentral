"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Deployment, Program, Profile, InternDeployment } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { DeploymentStatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, Users, UserPlus, X, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

type DeploymentForm = {
  name: string;
  description: string;
  program_id: string;
  school_year: string;
  semester: string;
  start_date: string;
  end_date: string;
  required_hours: string;
  status: string;
};

const defaultForm: DeploymentForm = {
  name: "",
  description: "",
  program_id: "",
  school_year: "",
  semester: "",
  start_date: "",
  end_date: "",
  required_hours: "600",
  status: "upcoming",
};

export default function DeploymentsPage() {
  const supabase = createClient();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [allFaculty, setAllFaculty] = useState<Profile[]>([]);
  const [allInterns, setAllInterns] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Deployment | null>(null);
  const [form, setForm] = useState<DeploymentForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Faculty assignment modal
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [facultyTarget, setFacultyTarget] = useState<Deployment | null>(null);
  const [assignedFaculty, setAssignedFaculty] = useState<string[]>([]);

  // Intern enrollment modal
  const [internModalOpen, setInternModalOpen] = useState(false);
  const [internTarget, setInternTarget] = useState<Deployment | null>(null);
  const [enrolledInterns, setEnrolledInterns] = useState<InternDeployment[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: deps }, { data: progs }, { data: faculty }, { data: interns }] =
      await Promise.all([
        supabase.from("deployments").select("*, programs(*), deployment_faculty(*, profiles(*))").order("created_at", { ascending: false }),
        supabase.from("programs").select("*").order("name"),
        supabase.from("profiles").select("*").eq("role", "faculty").order("full_name"),
        supabase.from("profiles").select("*").eq("role", "intern").order("full_name"),
      ]);
    if (deps) setDeployments(deps as Deployment[]);
    if (progs) setPrograms(progs as Program[]);
    if (faculty) setAllFaculty(faculty as Profile[]);
    if (interns) setAllInterns(interns as Profile[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(d: Deployment) {
    setEditing(d);
    setForm({
      name: d.name,
      description: d.description ?? "",
      program_id: d.program_id ?? "",
      school_year: d.school_year ?? "",
      semester: d.semester ?? "",
      start_date: d.start_date ?? "",
      end_date: d.end_date ?? "",
      required_hours: String(d.required_hours),
      status: d.status,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description || null,
      program_id: form.program_id || null,
      school_year: form.school_year || null,
      semester: form.semester || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      required_hours: parseInt(form.required_hours, 10),
      status: form.status,
    };
    try {
      if (editing) {
        const { error: err } = await supabase.from("deployments").update(payload).eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("deployments").insert(payload);
        if (err) throw err;
      }
      await loadData();
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: Deployment) {
    if (!confirm(`Delete deployment "${d.name}"?`)) return;
    const { error: err } = await supabase.from("deployments").delete().eq("id", d.id);
    if (err) alert(err.message);
    else await loadData();
  }

  // Faculty assignment
  async function openFacultyModal(d: Deployment) {
    setFacultyTarget(d);
    const existing = (d.deployment_faculty ?? []).map((df) => df.faculty_id);
    setAssignedFaculty(existing);
    setFacultyModalOpen(true);
  }

  async function saveFacultyAssignment() {
    if (!facultyTarget) return;
    setSaving(true);
    // Delete existing
    await supabase.from("deployment_faculty").delete().eq("deployment_id", facultyTarget.id);
    // Insert new
    if (assignedFaculty.length > 0) {
      await supabase.from("deployment_faculty").insert(
        assignedFaculty.map((fid) => ({ deployment_id: facultyTarget.id, faculty_id: fid }))
      );
    }
    await loadData();
    setFacultyModalOpen(false);
    setSaving(false);
  }

  // Intern enrollment
  async function openInternModal(d: Deployment) {
    setInternTarget(d);
    const { data } = await supabase
      .from("intern_deployments")
      .select("*, profiles(*)")
      .eq("deployment_id", d.id);
    setEnrolledInterns((data as InternDeployment[]) ?? []);
    setInternModalOpen(true);
  }

  async function enrollIntern(internId: string) {
    if (!internTarget) return;
    const { error: err } = await supabase.from("intern_deployments").insert({
      intern_id: internId,
      deployment_id: internTarget.id,
      required_hours: internTarget.required_hours,
      status: "pending",
    });
    if (err) { alert(err.message); return; }
    const { data } = await supabase
      .from("intern_deployments")
      .select("*, profiles(*)")
      .eq("deployment_id", internTarget.id);
    setEnrolledInterns((data as InternDeployment[]) ?? []);
  }

  async function unenrollIntern(enrollmentId: string) {
    if (!confirm("Remove this intern from the deployment?")) return;
    await supabase.from("intern_deployments").delete().eq("id", enrollmentId);
    setEnrolledInterns((prev) => prev.filter((e) => e.id !== enrollmentId));
  }

  const programOptions = [
    { value: "", label: "No program" },
    ...programs.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deployment Management</h1>
          <p className="text-slate-500 text-sm">Create and manage OJT deployments (classes)</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={16} />}>New Deployment</Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><LoadingSpinner /></div>
      ) : deployments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
          No deployments yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {deployments.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{d.name}</p>
                    <DeploymentStatusBadge status={d.status} />
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {d.programs?.name ?? "No program"} &bull; {d.required_hours} hrs
                    {d.school_year && ` · ${d.school_year}`}
                    {d.semester && ` · ${d.semester}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" icon={<Users size={14} />} onClick={() => openFacultyModal(d)}>
                    <span className="hidden sm:inline">Faculty</span>
                  </Button>
                  <Button size="sm" variant="ghost" icon={<UserPlus size={14} />} onClick={() => openInternModal(d)}>
                    <span className="hidden sm:inline">Interns</span>
                  </Button>
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                  >
                    {expandedId === d.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {expandedId === d.id && (
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                    {d.description && <p className="text-slate-600 col-span-2">{d.description}</p>}
                    <div><span className="text-slate-400">Start Date: </span><span className="text-slate-700">{formatDate(d.start_date)}</span></div>
                    <div><span className="text-slate-400">End Date: </span><span className="text-slate-700">{formatDate(d.end_date)}</span></div>
                    <div className="col-span-2">
                      <span className="text-slate-400">Assigned Faculty: </span>
                      {(d.deployment_faculty ?? []).length === 0
                        ? <span className="text-slate-400">None</span>
                        : d.deployment_faculty?.map((df) => df.profiles?.full_name).join(", ")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Deployment form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Deployment" : "New Deployment"} maxWidth="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Deployment Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Program" value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} options={programOptions} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUS_OPTIONS} />
            <Input label="School Year" value={form.school_year} onChange={(e) => setForm({ ...form, school_year: e.target.value })} placeholder="e.g. 2025–2026" />
            <Input label="Semester" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="e.g. 2nd Semester" />
            <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <Input label="End Date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            <Input label="Required Hours" type="number" min="1" value={form.required_hours} onChange={(e) => setForm({ ...form, required_hours: e.target.value })} required />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Create Deployment"}</Button>
          </div>
        </form>
      </Modal>

      {/* Faculty assignment modal */}
      <Modal open={facultyModalOpen} onClose={() => setFacultyModalOpen(false)} title={`Assign Faculty – ${facultyTarget?.name}`} maxWidth="sm">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">Select faculty members to assign to this deployment.</p>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            {allFaculty.map((f) => (
              <label key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignedFaculty.includes(f.id)}
                  onChange={(e) => {
                    if (e.target.checked) setAssignedFaculty([...assignedFaculty, f.id]);
                    else setAssignedFaculty(assignedFaculty.filter((id) => id !== f.id));
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-800">{f.full_name}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setFacultyModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={saveFacultyAssignment}>Save Assignment</Button>
          </div>
        </div>
      </Modal>

      {/* Intern enrollment modal */}
      <Modal open={internModalOpen} onClose={() => setInternModalOpen(false)} title={`Interns – ${internTarget?.name}`} maxWidth="lg">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Enrolled Interns</p>
            {enrolledInterns.length === 0 ? (
              <p className="text-slate-400 text-sm">No interns enrolled yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {enrolledInterns.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-800">{e.profiles?.full_name ?? "—"}</span>
                    <button onClick={() => unenrollIntern(e.id)} className="text-slate-400 hover:text-red-600 transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Add Intern</p>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {allInterns
                .filter((i) => !enrolledInterns.some((e) => e.intern_id === i.id))
                .map((i) => (
                  <div key={i.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-800">{i.full_name}</span>
                    <Button size="sm" variant="outline" onClick={() => enrollIntern(i.id)}>
                      Enroll
                    </Button>
                  </div>
                ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setInternModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
