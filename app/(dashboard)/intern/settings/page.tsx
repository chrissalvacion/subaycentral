"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function InternSettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [pwForm, setPwForm] = useState({ newPw: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name, phone: profile.phone ?? "" });
  }, [profile]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone || null }).eq("id", profile!.id);
    if (error) setMsg(`Error: ${error.message}`);
    else {
      await refreshProfile();
      setMsg("Profile updated successfully.");
    }
    setSaving(false);
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) {
      setPwMsg("New passwords do not match.");
      return;
    }
    if (pwForm.newPw.length < 6) {
      setPwMsg("Password must be at least 6 characters.");
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    if (error) setPwMsg(`Error: ${error.message}`);
    else {
      setPwMsg("Password changed successfully.");
      setPwForm({ newPw: "", confirm: "" });
    }
    setPwSaving(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500 text-sm">Update your profile and password</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Profile Information</h2></div>
        <form onSubmit={handleProfileSave} className="p-6 flex flex-col gap-4">
          <Input label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          <Input label="Email" value={profile?.email ?? ""} disabled />
          <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {msg && <p className={`text-sm rounded-lg px-3 py-2 ${msg.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>{msg}</p>}
          <div className="flex justify-end"><Button type="submit" loading={saving}>Save Profile</Button></div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Change Password</h2></div>
        <form onSubmit={handlePasswordSave} className="p-6 flex flex-col gap-4">
          <Input label="New Password" type="password" value={pwForm.newPw} onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })} required />
          <Input label="Confirm New Password" type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required />
          {pwMsg && <p className={`text-sm rounded-lg px-3 py-2 ${pwMsg.startsWith("Error") || pwMsg.includes("match") || pwMsg.includes("least") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>{pwMsg}</p>}
          <div className="flex justify-end"><Button type="submit" loading={pwSaving}>Change Password</Button></div>
        </form>
      </div>
    </div>
  );
}
