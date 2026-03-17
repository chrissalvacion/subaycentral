"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

type FormData = {
  date: string;
  tasks: string;
  notes: string;
};

function getTodayDate() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function NewDailyRecordPage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile } = useAuth();

  const [internDeploymentId, setInternDeploymentId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ date: "", tasks: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const currentProfile = profile;

    async function loadDeployment() {
      const { data: dep } = await supabase
        .from("intern_deployments")
        .select("id")
        .eq("intern_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setInternDeploymentId(dep?.id ?? null);
    }

    loadDeployment();
  }, [profile, supabase]);

  useEffect(() => {
    setForm((current) => {
      if (current.date) return current;
      return { ...current, date: getTodayDate() };
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !internDeploymentId) return;

    setSaving(true);
    setError(null);

    const payload = {
      intern_id: profile.id,
      intern_deployment_id: internDeploymentId,
      date: form.date,
      tasks: form.tasks,
      notes: form.notes || null,
    };

    try {
      const { data, error: insertError } = await supabase
        .from("daily_records")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;

      if (data?.id) {
        router.push(`/intern/records/${data.id}`);
      } else {
        router.push("/intern/records");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create daily record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Daily Record</h1>
          <p className="text-slate-500 text-sm">Record your daily accomplishments and notes</p>
        </div>
        <Link href="/intern/records">
          <Button variant="secondary">Back to List</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        {!internDeploymentId ? (
          <p className="text-sm text-slate-500">No active deployment found.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Link href="/intern/records">
                <Button type="button" variant="secondary">Cancel</Button>
              </Link>
              <Button type="submit" loading={saving}>Save Record</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
