"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Feedback } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";

export default function InternFeedbackPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

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
                <div>
                  <p className="font-semibold text-slate-900">{item.profiles?.full_name ?? "Faculty"}</p>
                  <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
                </div>
                <div className="text-sm font-medium text-indigo-600">
                  {item.performance_rating ? `${item.performance_rating}/5` : "No rating"}
                </div>
              </div>
              <p className="text-slate-700 mt-3 whitespace-pre-line">{item.content}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
