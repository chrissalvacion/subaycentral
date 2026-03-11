"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Feedback } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { Check } from "lucide-react";

export default function InternFeedbackPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const currentProfile = profile;
    async function load() {
      const { data: dep } = await supabase
        .from("intern_deployments")
        .select("id")
        .eq("intern_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!dep) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("feedback")
        .select("*, profiles!feedback_faculty_id_fkey(*)")
        .eq("intern_deployment_id", dep.id)
        .order("created_at", { ascending: false });
      setFeedback((data as Feedback[]) ?? []);
      setLoading(false);
    }
    load();
  }, [profile, supabase]);

  const handleAcknowledge = async (feedbackId: string, currentReadAt: string | null) => {
    setAcknowledging(feedbackId);
    try {
      const newReadAt = currentReadAt ? null : new Date().toISOString();
      const { error } = await supabase
        .from("feedback")
        .update({ intern_read_at: newReadAt })
        .eq("id", feedbackId);

      if (error) throw error;

      setFeedback((prev) =>
        prev.map((item) => 
          item.id === feedbackId ? { ...item, intern_read_at: newReadAt } : item
        )
      );
    } catch (err) {
      console.error("Failed to toggle acknowledgement:", err);
    } finally {
      setAcknowledging(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Feedback</h1>
        <p className="text-slate-500 text-sm">Review feedback from your faculty supervisors</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><LoadingSpinner /></div>
      ) : feedback.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 text-sm">No feedback yet.</div>
      ) : (
        <div className="space-y-4">
          {feedback.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{item.profiles?.full_name ?? "Faculty"}</p>
                  <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
                </div>
                <button
                  onClick={() => handleAcknowledge(item.id, item.intern_read_at)}
                  disabled={acknowledging === item.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                    item.intern_read_at
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  } disabled:opacity-50`}
                >
                  <Check size={14} />
                  {item.intern_read_at ? "Read" : "Mark as Read"}
                </button>
              </div>
              <p className="text-slate-700 mt-3 whitespace-pre-line">{item.content}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
