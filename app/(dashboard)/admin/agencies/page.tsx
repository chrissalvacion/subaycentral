"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PartnerAgency } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";

type FormData = {
  name: string;
  address: string;
  contact_person: string;
  contact_number: string;
  email: string;
};
const defaultForm: FormData = {
  name: "",
  address: "",
  contact_person: "",
  contact_number: "",
  email: "",
};

export default function AgenciesPage() {
  const supabase = createClient();
  const [agencies, setAgencies] = useState<PartnerAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerAgency | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("partner_agencies")
      .select("*")
      .order("name");
    if (data) setAgencies(data as PartnerAgency[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(a: PartnerAgency) {
    setEditing(a);
    setForm({
      name: a.name,
      address: a.address ?? "",
      contact_person: a.contact_person ?? "",
      contact_number: a.contact_number ?? "",
      email: a.email ?? "",
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
      address: form.address || null,
      contact_person: form.contact_person || null,
      contact_number: form.contact_number || null,
      email: form.email || null,
    };
    try {
      if (editing) {
        const { error: err } = await supabase.from("partner_agencies").update(payload).eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("partner_agencies").insert(payload);
        if (err) throw err;
      }
      await fetch();
      setModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: PartnerAgency) {
    if (!confirm(`Delete agency "${a.name}"?`)) return;
    const { error: err } = await supabase.from("partner_agencies").delete().eq("id", a.id);
    if (err) alert(err.message);
    else await fetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partner Agencies</h1>
          <p className="text-slate-500 text-sm">Manage OJT host organizations</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={16} />}>Add Agency</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-slate-100 animate-pulse" />
          ))
        ) : agencies.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-100">
            No partner agencies yet.
          </div>
        ) : (
          agencies.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Building2 size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{a.name}</p>
                    <p className="text-slate-400 text-xs">{formatDate(a.created_at)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                {a.address && <p>📍 {a.address}</p>}
                {a.contact_person && <p>👤 {a.contact_person}</p>}
                {a.contact_number && <p>📞 {a.contact_number}</p>}
                {a.email && <p>✉️ {a.email}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Agency" : "Add Agency"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Agency Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          <Input label="Contact Number" type="tel" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save Changes" : "Add Agency"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
