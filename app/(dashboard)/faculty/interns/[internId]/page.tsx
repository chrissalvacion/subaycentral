"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCheck, ChevronRight, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DailyRecord, Feedback, InternDeployment, PartnerAgency, Profile, TimeRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { InternStatusBadge } from "@/components/ui/Badge";
import { formatDate, formatHours, formatTime } from "@/lib/utils";

type InternDeploymentRow = InternDeployment & {
  partner_agencies?: PartnerAgency | null;
};

type DetailData = {
  profile: Profile | null;
  deployment: InternDeploymentRow | null;
  dailyRecords: DailyRecord[];
  timeRecords: TimeRecord[];
  feedback: Feedback[];
};

type ConfirmAction =
  | { type: "update-feedback" }
  | { type: "delete-feedback"; feedbackId: string }
  | null;

export default function FacultyInternDetailPage() {
  const supabase = createClient();
  const { profile: facultyProfile } = useAuth();
  const params = useParams<{ internId: string }>();
  const internId = params?.internId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DetailData>({
    profile: null,
    deployment: null,
    dailyRecords: [],
    timeRecords: [],
    feedback: [],
  });
  const [feedbackText, setFeedbackText] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "time" | "feedback">("daily");
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editingFeedbackText, setEditingFeedbackText] = useState("");
  const [savingFeedbackEdit, setSavingFeedbackEdit] = useState(false);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [reactingFeedbackId, setReactingFeedbackId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");

  const load = useCallback(async () => {
    if (!internId) return;
    setLoading(true);

    const { data: internProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", internId)
      .eq("role", "intern")
      .single();

    const profileRow = (internProfile as Profile | null) ?? null;

    if (!profileRow) {
      setData({
        profile: null,
        deployment: null,
        dailyRecords: [],
        timeRecords: [],
        feedback: [],
      });
      setLoading(false);
      return;
    }

    if (
      facultyProfile?.program &&
      facultyProfile?.section &&
      (profileRow.program !== facultyProfile.program || profileRow.section !== facultyProfile.section)
    ) {
      setData({
        profile: null,
        deployment: null,
        dailyRecords: [],
        timeRecords: [],
        feedback: [],
      });
      setLoading(false);
      return;
    }

    const { data: deploymentRows } = await supabase
      .from("intern_deployments")
      .select("*, partner_agencies(*)")
      .eq("intern_id", internId)
      .order("created_at", { ascending: false })
      .limit(1);

    const deployment = ((deploymentRows as InternDeploymentRow[] | null) ?? [])[0] ?? null;

    if (!deployment) {
      setData({
        profile: profileRow,
        deployment: null,
        dailyRecords: [],
        timeRecords: [],
        feedback: [],
      });
      setLoading(false);
      return;
    }

    const [{ data: daily }, { data: time }, { data: fb }] = await Promise.all([
      supabase
        .from("daily_records")
        .select("*")
        .eq("intern_deployment_id", deployment.id)
        .order("date", { descending: false }),
      supabase
        .from("time_records")
        .select("*")
        .eq("intern_deployment_id", deployment.id)
        .order("date", { descending: false }),
      supabase
        .from("feedback")
        .select("*")
        .eq("intern_deployment_id", deployment.id)
        .order("created_at", { descending: false }),
    ]);

    setData({
      profile: profileRow,
      deployment,
      dailyRecords: (daily as DailyRecord[]) ?? [],
      timeRecords: (time as TimeRecord[]) ?? [],
      feedback: (fb as Feedback[]) ?? [],
    });
    setLoading(false);
  }, [internId, facultyProfile, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function openNotice(message: string) {
    setNoticeMessage(message);
    setNoticeOpen(true);
  }

  async function submitFeedback() {
    if (!data.profile || !data.deployment || !facultyProfile || !feedbackText.trim()) return;

    setSavingFeedback(true);
    const { error } = await supabase.from("feedback").insert({
      faculty_id: facultyProfile.id,
      intern_id: data.profile.id,
      intern_deployment_id: data.deployment.id,
      content: feedbackText,
      performance_rating: null,
    });

    if (error) {
      openNotice(error.message);
    } else {
      setFeedbackText("");
      await load();
    }
    setSavingFeedback(false);
  }

  function startEditFeedback(entry: Feedback) {
    setEditingFeedbackId(entry.id);
    setEditingFeedbackText(entry.content);
  }

  function requestSaveEditedFeedback() {
    if (!editingFeedbackId || !editingFeedbackText.trim()) return;
    setConfirmTitle("Confirm Update");
    setConfirmMessage("Save changes to this feedback record?");
    setConfirmAction({ type: "update-feedback" });
    setConfirmOpen(true);
  }

  async function saveEditedFeedback() {
    if (!editingFeedbackId || !editingFeedbackText.trim()) return;

    setSavingFeedbackEdit(true);
    const { error } = await supabase
      .from("feedback")
      .update({ content: editingFeedbackText.trim() })
      .eq("id", editingFeedbackId)
      .eq("faculty_id", facultyProfile?.id ?? "");

    if (error) {
      openNotice(error.message);
    } else {
      setEditingFeedbackId(null);
      setEditingFeedbackText("");
      await load();
    }
    setSavingFeedbackEdit(false);
  }

  function requestDeleteFeedback(feedbackId: string) {
    setConfirmTitle("Confirm Delete");
    setConfirmMessage("Delete this feedback record? This action cannot be undone.");
    setConfirmAction({ type: "delete-feedback", feedbackId });
    setConfirmOpen(true);
  }

  async function deleteFeedback(feedbackId: string) {

    setDeletingFeedbackId(feedbackId);
    const { error } = await supabase
      .from("feedback")
      .delete()
      .eq("id", feedbackId)
      .eq("faculty_id", facultyProfile?.id ?? "");

    if (error) {
      openNotice(error.message);
    } else {
      await load();
    }
    setDeletingFeedbackId(null);
  }

  async function handleConfirmAction() {
    if (!confirmAction) {
      setConfirmOpen(false);
      return;
    }

    setConfirmOpen(false);
    if (confirmAction.type === "update-feedback") {
      await saveEditedFeedback();
    }
    if (confirmAction.type === "delete-feedback") {
      await deleteFeedback(confirmAction.feedbackId);
    }
    setConfirmAction(null);
  }

  async function toggleReaction(entry: Feedback) {
    setReactingFeedbackId(entry.id);
    const nextReaction = entry.reaction === "acknowledged" ? null : "acknowledged";

    const { error } = await supabase
      .from("feedback")
      .update({ reaction: nextReaction })
      .eq("id", entry.id)
      .eq("faculty_id", facultyProfile?.id ?? "");

    if (error) {
      openNotice(error.message);
    } else {
      await load();
    }
    setReactingFeedbackId(null);
  }

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data.profile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/faculty/interns" className="hover:text-indigo-700 hover:underline">
            Interns
          </Link>
          <ChevronRight size={14} />
          <span className="text-slate-700 font-medium">Details</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Intern not found or not under your assigned section.
        </div>
      </div>
    );
  }

  const dailyRenderedHours = Array.from(
    data.timeRecords.reduce((map, record) => {
      const dateKey = record.date;
      const current = map.get(dateKey) ?? 0;
      map.set(dateKey, Number((current + Number(record.total_hours ?? 0)).toFixed(2)));
      return map;
    }, new Map<string, number>())
  )
    .map(([date, hours]) => ({ date, hours }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const chartWidth = 760;
  const chartHeight = 260;
  const chartPadding = 32;
  const maxHours = Math.max(1, ...dailyRenderedHours.map((point) => point.hours));
  const linePoints = dailyRenderedHours.map((point, index, list) => {
    const x = chartPadding + (index * (chartWidth - chartPadding * 2)) / Math.max(1, list.length - 1);
    const y = chartHeight - chartPadding - (point.hours / maxHours) * (chartHeight - chartPadding * 2);
    return { ...point, x, y };
  });
  const linePath = linePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/faculty/interns" className="hover:text-indigo-700 hover:underline">
            Interns
          </Link>
          <ChevronRight size={14} />
          <span className="text-slate-700 font-medium">{data.profile.full_name}</span>
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{data.profile.full_name}</h1>
            {data.deployment && <InternStatusBadge status={data.deployment.status} />}
          </div>
          <p className="text-sm text-slate-500">Intern details, records, and feedback history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Profile</p>
          <p><span className="text-slate-500">Email:</span> {data.profile.email}</p>
          <p><span className="text-slate-500">Contact Number:</span> {data.profile.phone ?? "—"}</p>
          <p><span className="text-slate-500">Program:</span> {data.profile.program ?? "—"}</p>
          <p><span className="text-slate-500">Section:</span> {data.profile.section ?? "—"}</p>
          <p><span className="text-slate-500">Student ID:</span> {data.profile.student_id ?? "—"}</p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Deployment</p>
          {data.deployment ? (
            <>
              <p><span className="text-slate-500">Start Date:</span> {formatDate(data.deployment.start_date)}</p>
              <p><span className="text-slate-500">Expected End:</span> {formatDate(data.deployment.expected_end_date)}</p>
              <p><span className="text-slate-500">Agency:</span> {data.deployment.partner_agencies?.name ?? "—"}</p>
              <p><span className="text-slate-500">Address:</span> {data.deployment.partner_agencies?.address ?? "—"}</p>
              <p><span className="text-slate-500">Rendered Hours:</span> {formatHours(data.deployment.rendered_hours)}</p>
              {/* <div className="pt-2">
                <InternStatusBadge status={data.deployment.status} />
              </div> */}
            </>
          ) : (
            <p className="text-slate-500">No deployment record found.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 border border-slate-100 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Rendered Hours Fluctuation</h2>
          <p className="text-sm text-slate-500">Daily total rendered hours from the selected intern's time records</p>
        </div>

        {dailyRenderedHours.length === 0 ? (
          <p className="text-sm text-slate-400">No time records available for chart display yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full min-w-[700px]"
              role="img"
              aria-label="Daily rendered hours chart"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const y = chartHeight - chartPadding - tick * (chartHeight - chartPadding * 2);
                return (
                  <g key={tick}>
                    <line x1={chartPadding} y1={y} x2={chartWidth - chartPadding} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                    <text x={8} y={y + 4} fontSize="11" fill="#64748b">
                      {(maxHours * tick).toFixed(1)}
                    </text>
                  </g>
                );
              })}

              <line
                x1={chartPadding}
                y1={chartHeight - chartPadding}
                x2={chartWidth - chartPadding}
                y2={chartHeight - chartPadding}
                stroke="#94a3b8"
                strokeWidth="1"
              />

              {linePath ? <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2.5" /> : null}

              {linePoints.map((point) => (
                <g key={point.date}>
                  <circle cx={point.x} cy={point.y} r="3.5" fill="#4f46e5" />
                  <title>{`${formatDate(point.date)}: ${point.hours} hour(s)`}</title>
                </g>
              ))}

              <text x={chartPadding} y={chartHeight - 8} fontSize="11" fill="#64748b">
                {formatDate(dailyRenderedHours[0].date)}
              </text>
              <text x={chartWidth - chartPadding} y={chartHeight - 8} fontSize="11" textAnchor="end" fill="#64748b">
                {formatDate(dailyRenderedHours[dailyRenderedHours.length - 1].date)}
              </text>
            </svg>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="border-b border-slate-100 px-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("daily")}
              className={[
                "px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors",
                activeTab === "daily"
                  ? "border-indigo-600 text-indigo-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              Daily Records
            </button>
            <button
              onClick={() => setActiveTab("time")}
              className={[
                "px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors",
                activeTab === "time"
                  ? "border-indigo-600 text-indigo-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              Time Records
            </button>
            <button
              onClick={() => setActiveTab("feedback")}
              className={[
                "px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors",
                activeTab === "feedback"
                  ? "border-indigo-600 text-indigo-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              Feedback History
            </button>
          </div>
        </div>

        <div className="p-4">
          {activeTab === "daily" && (
            <div>
              {data.dailyRecords.length === 0 ? (
                <p className="text-slate-400">No daily records yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                  {data.dailyRecords.map((record) => (
                    <div key={record.id} className="px-4 py-3">
                      <p className="font-medium text-slate-800">{formatDate(record.date)}</p>
                      <p className="text-slate-600 whitespace-pre-line mt-1">{record.tasks}</p>
                      {record.notes && <p className="text-slate-500 mt-1">Notes: {record.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "time" && (
            <div>
              {data.timeRecords.length === 0 ? (
                <p className="text-slate-400">No time records yet.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">AM In</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">AM Out</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">PM In</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">PM Out</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Total Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.timeRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{formatDate(record.date)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatTime(record.morning_time_in ?? record.time_in)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatTime(record.morning_time_out)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatTime(record.afternoon_time_in)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatTime(record.afternoon_time_out ?? record.time_out)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatHours(record.total_hours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "feedback" && (
            <div className="space-y-4">
              <div>
                {data.feedback.length === 0 ? (
                  <p className="text-slate-400">No feedback yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.feedback.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-slate-200 p-4 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-800">Faculty Feedback</p>
                          <p className="text-xs text-slate-400">{formatDate(entry.created_at)}</p>
                        </div>

                        {editingFeedbackId === entry.id ? (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={editingFeedbackText}
                              onChange={(event) => setEditingFeedbackText(event.target.value)}
                              rows={4}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setEditingFeedbackId(null);
                                  setEditingFeedbackText("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button onClick={requestSaveEditedFeedback} loading={savingFeedbackEdit}>
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-600 mt-2 whitespace-pre-line">{entry.content}</p>
                        )}

                        {entry.reaction === "acknowledged" && (
                          <p className="text-xs text-emerald-700 mt-2">Acknowledged</p>
                        )}

                        {entry.intern_read_at && (
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Intern read on {formatDate(entry.intern_read_at)}
                          </p>
                        )}

                        {entry.faculty_id === facultyProfile?.id && editingFeedbackId !== entry.id && (
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<CheckCheck size={14} />}
                              onClick={() => toggleReaction(entry)}
                              loading={reactingFeedbackId === entry.id}
                            >
                              {entry.reaction === "acknowledged" ? "Unacknowledge" : "Acknowledge"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Pencil size={14} />}
                              onClick={() => startEditFeedback(entry)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Trash2 size={14} />}
                              onClick={() => requestDeleteFeedback(entry.id)}
                              loading={deletingFeedbackId === entry.id}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Add Feedback</h3>
                {!data.deployment ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
                    Feedback is available after the intern is enrolled in a deployment.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      label="Feedback"
                      value={feedbackText}
                      onChange={(event) => setFeedbackText(event.target.value)}
                      rows={4}
                      placeholder="Write your feedback for the intern..."
                    />
                    <div className="flex justify-end">
                      <Button
                        icon={<MessageSquare size={14} />}
                        loading={savingFeedback}
                        onClick={submitFeedback}
                      >
                        Submit Feedback
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmAction(null);
        }}
        title={confirmTitle || "Confirm"}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{confirmMessage}</p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmAction(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmAction}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        title="Notice"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 whitespace-pre-line">{noticeMessage}</p>
          <div className="flex justify-end">
            <Button onClick={() => setNoticeOpen(false)}>OK</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
