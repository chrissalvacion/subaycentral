"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Profile, InternDeployment, PartnerAgency, DailyRecord, TimeRecord, Feedback } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { InternStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatTime, formatHours } from "@/lib/utils";
import { Search, Building2, MessageSquare, Eye } from "lucide-react";

type InternRow = InternDeployment & {
  profiles?: Profile;
  partner_agencies?: PartnerAgency;
};

type DetailData = {
  dailyRecords: DailyRecord[];
  timeRecords: TimeRecord[];
  feedback: Feedback[];
};

export default function FacultyInternsPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [interns, setInterns] = useState<InternRow[]>([]);
  const [agencies, setAgencies] = useState<PartnerAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIntern, setSelectedIntern] = useState<InternRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<DetailData>({
    dailyRecords: [],
    timeRecords: [],
    feedback: [],
  });
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [savingFeedback, setSavingFeedback] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const currentProfile = profile;
    setLoading(true);

    const { data: depFac } = await supabase
      .from("deployment_faculty")
      .select("deployment_id")
      .eq("faculty_id", currentProfile.id);
    const deploymentIds =
      ((depFac as { deployment_id: string }[] | null) ?? []).map(
        (d) => d.deployment_id
      );

    if (deploymentIds.length === 0) {
      setInterns([]);
      setLoading(false);
      return;
    }

    const [{ data: internDeps }, { data: agencyList }] = await Promise.all([
      supabase
        .from("intern_deployments")
        .select("*, profiles(*), partner_agencies(*)")
        .in("deployment_id", deploymentIds)
        .order("created_at", { ascending: false }),
      supabase.from("partner_agencies").select("*").order("name"),
    ]);

    setInterns((internDeps as InternRow[]) ?? []);
    setAgencies((agencyList as PartnerAgency[]) ?? []);
    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => { load(); }, [load]);

  async function assignAgency(row: InternRow, agencyId: string) {
    const { error } = await supabase
      .from("intern_deployments")
      .update({ agency_id: agencyId || null, status: "active" })
      .eq("id", row.id);
    if (error) alert(error.message);
    else await load();
  }

  async function openDetails(row: InternRow) {
    setSelectedIntern(row);
    setDetailOpen(true);
    const [{ data: daily }, { data: time }, { data: fb }] = await Promise.all([
      supabase
        .from("daily_records")
        .select("*")
        .eq("intern_deployment_id", row.id)
        .order("date", { ascending: false }),
      supabase
        .from("time_records")
        .select("*")
        .eq("intern_deployment_id", row.id)
        .order("date", { ascending: false }),
      supabase
        .from("feedback")
        .select("*, profiles!feedback_faculty_id_fkey(*)")
        .eq("intern_deployment_id", row.id)
        .order("created_at", { ascending: false }),
    ]);
    setDetailData({
      dailyRecords: (daily as DailyRecord[]) ?? [],
      timeRecords: (time as TimeRecord[]) ?? [],
      feedback: (fb as Feedback[]) ?? [],
    });
  }

  async function submitFeedback() {
    if (!selectedIntern || !profile || !feedbackText.trim()) return;
    const currentProfile = profile;
    setSavingFeedback(true);
    const { error } = await supabase.from("feedback").insert({
      faculty_id: currentProfile.id,
      intern_id: selectedIntern.intern_id,
      intern_deployment_id: selectedIntern.id,
      content: feedbackText,
      performance_rating: parseInt(feedbackRating, 10),
    });
    if (error) alert(error.message);
    else {
      setFeedbackText("");
      setFeedbackRating("5");
      await openDetails(selectedIntern);
    }
    setSavingFeedback(false);
  }

  const filtered = interns.filter((row) => {
    const q = search.toLowerCase();
    return (
      row.profiles?.full_name?.toLowerCase().includes(q) ||
      row.profiles?.email?.toLowerCase().includes(q)
    );
  });

  const agencyOptions = [
    { value: "", label: "Unassigned" },
    ...agencies.map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Assigned Interns</h1>
        <p className="text-slate-500 text-sm">View, assign, and evaluate your interns</p>
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
          <div className="p-10 text-center text-slate-400 text-sm">No interns assigned.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Intern</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Agency</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Start / End</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.profiles?.full_name}</p>
                      <p className="text-slate-500 text-xs">{row.profiles?.email}</p>
                      <p className="text-slate-400 text-xs md:hidden mt-1">{row.partner_agencies?.name ?? "No agency"}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell min-w-[220px]">
                      <Select
                        options={agencyOptions}
                        value={row.agency_id ?? ""}
                        onChange={(e) => assignAgency(row, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      <div>{formatDate(row.start_date)}</div>
                      <div>{formatDate(row.expected_end_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <InternStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={<Building2 size={14} />} className="md:hidden" onClick={() => assignAgency(row, row.agency_id ?? "")}>Agency</Button>
                        <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => openDetails(row)}>View</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={selectedIntern?.profiles?.full_name ?? "Intern Details"} maxWidth="xl">
        {selectedIntern && (
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Profile</p>
                <p><span className="text-slate-500">Email:</span> {selectedIntern.profiles?.email}</p>
                <p><span className="text-slate-500">Start Date:</span> {formatDate(selectedIntern.start_date)}</p>
                <p><span className="text-slate-500">Expected End:</span> {formatDate(selectedIntern.expected_end_date)}</p>
                <p><span className="text-slate-500">Agency:</span> {selectedIntern.partner_agencies?.name ?? "—"}</p>
                <p><span className="text-slate-500">Rendered Hours:</span> {formatHours(selectedIntern.rendered_hours)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Add Feedback</p>
                <div className="space-y-3">
                  <Select label="Performance Rating" value={feedbackRating} onChange={(e) => setFeedbackRating(e.target.value)} options={[1,2,3,4,5].map((n) => ({ value: String(n), label: `${n} / 5` }))} />
                  <Textarea label="Feedback" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={4} placeholder="Write your feedback for the intern..." />
                  <div className="flex justify-end">
                    <Button icon={<MessageSquare size={14} />} loading={savingFeedback} onClick={submitFeedback}>Submit Feedback</Button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Daily Records</h3>
              {detailData.dailyRecords.length === 0 ? (
                <p className="text-slate-400">No daily records yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {detailData.dailyRecords.map((r) => (
                    <div key={r.id} className="px-4 py-3">
                      <p className="font-medium text-slate-800">{formatDate(r.date)}</p>
                      <p className="text-slate-600 whitespace-pre-line mt-1">{r.tasks}</p>
                      {r.notes && <p className="text-slate-500 mt-1">Notes: {r.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Time Logs</h3>
              {detailData.timeRecords.length === 0 ? (
                <p className="text-slate-400">No time records yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {detailData.timeRecords.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
                      <p className="font-medium text-slate-800 min-w-[140px]">{formatDate(r.date)}</p>
                      <p className="text-slate-600">In: {formatTime(r.time_in)}</p>
                      <p className="text-slate-600">Out: {formatTime(r.time_out)}</p>
                      <p className="text-slate-600">Hours: {formatHours(r.total_hours)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Feedback History</h3>
              {detailData.feedback.length === 0 ? (
                <p className="text-slate-400">No feedback yet.</p>
              ) : (
                <div className="space-y-3">
                  {detailData.feedback.map((f) => (
                    <div key={f.id} className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-800">Rating: {f.performance_rating ?? "—"}/5</p>
                        <p className="text-xs text-slate-400">{formatDate(f.created_at)}</p>
                      </div>
                      <p className="text-slate-600 mt-2 whitespace-pre-line">{f.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
