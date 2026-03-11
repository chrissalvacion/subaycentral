"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DailyRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";

type FormData = {
  date: string;
  tasks: string;
  notes: string;
};

export default function DailyRecordDetailsPage() {
  const params = useParams<{ recordId: string }>();
  const recordId = params.recordId;

  const supabase = createClient();
  const router = useRouter();
  const { profile } = useAuth();

  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setForm] = useState<FormData>({ date: "", tasks: "", notes: "" });

  useEffect(() => {
    if (!profile || !recordId) return;
    const currentProfile = profile;

    async function loadRecord() {
      setLoading(true);

      const { data: dep } = await supabase
        .from("intern_deployments")
        .select("id")
        .eq("intern_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!dep) {
        setRecord(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("daily_records")
        .select("*")
        .eq("id", recordId)
        .eq("intern_deployment_id", dep.id)
        .single();

      const loaded = (data as DailyRecord | null) ?? null;
      setRecord(loaded);
      if (loaded) {
        setForm({
          date: loaded.date,
          tasks: loaded.tasks,
          notes: loaded.notes ?? "",
        });
      }
      setLoading(false);
    }

    loadRecord();
  }, [profile, recordId, supabase]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("daily_records")
      .update({
        date: form.date,
        tasks: form.tasks,
        notes: form.notes || null,
      })
      .eq("id", record.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setRecord({
      ...record,
      date: form.date,
      tasks: form.tasks,
      notes: form.notes || null,
    });
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!record) return;
    setDeleting(true);

    const { error: deleteError } = await supabase
      .from("daily_records")
      .delete()
      .eq("id", record.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      setConfirmOpen(false);
      return;
    }

    router.push("/intern/records");
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Record not found.</p>
        <Link href="/intern/records">
          <Button variant="secondary">Back to List</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Record</h1>
          <p className="text-slate-500 text-sm">{formatDate(record.date)}</p>
        </div>
        <Link href="/intern/records">
          <Button variant="secondary">Back to List</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <Textarea
              label="Tasks / Accomplishments"
              value={form.tasks}
              onChange={(e) => setForm({ ...form, tasks: e.target.value })}
              rows={7}
              required
            />

            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
            />

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Update Record</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Date</p>
              <p className="text-slate-900 font-medium mt-1">{formatDate(record.date)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Tasks / Accomplishments</p>
              <p className="text-slate-700 mt-2 whitespace-pre-line">{record.tasks}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Notes</p>
              <p className="text-slate-700 mt-2 whitespace-pre-line">{record.notes ?? "-"}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmOpen(true)}>Delete</Button>
              <Button onClick={() => setEditing(true)}>Edit</Button>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (deleting) return;
          setConfirmOpen(false);
        }}
        title="Delete Daily Record?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to delete this record dated {formatDate(record.date)}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
