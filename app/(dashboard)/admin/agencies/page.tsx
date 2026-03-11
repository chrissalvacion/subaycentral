"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { PartnerAgency } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

type FormData = {
  name: string;
  address: string;
  contact_person: string;
  contact_number: string;
  email: string;
  intern_slot_limit: string;
};
const defaultForm: FormData = {
  name: "",
  address: "",
  contact_person: "",
  contact_number: "",
  email: "",
  intern_slot_limit: "",
};

export default function AgenciesPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [agencies, setAgencies] = useState<PartnerAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerAgency | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
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
      intern_slot_limit: a.intern_slot_limit != null ? String(a.intern_slot_limit) : "",
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
      intern_slot_limit:
        form.intern_slot_limit.trim() === ""
          ? null
          : parseInt(form.intern_slot_limit, 10),
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

  function parseCsvLine(line: string) {
    const values: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  async function importCsvFile(file: File) {
    setImporting(true);

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length < 2) {
        alert("CSV must include a header row and at least one data row.");
        return;
      }

      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      const nameIndex = header.indexOf("name");

      if (nameIndex === -1) {
        alert("CSV must contain a 'name' column.");
        return;
      }

      const addressIndex = header.indexOf("address");
      const contactPersonIndex = header.indexOf("contact_person");
      const contactNumberIndex = header.indexOf("contact_number");
      const emailIndex = header.indexOf("email");
      const slotLimitIndex = header.indexOf("intern_slot_limit");

      const rows = lines.slice(1);
      const payload = rows
        .map((line) => parseCsvLine(line))
        .map((cols) => {
          const rawName = cols[nameIndex] ?? "";
          const rawAddress = addressIndex >= 0 ? (cols[addressIndex] ?? "") : "";
          const rawContactPerson = contactPersonIndex >= 0 ? (cols[contactPersonIndex] ?? "") : "";
          const rawContactNumber = contactNumberIndex >= 0 ? (cols[contactNumberIndex] ?? "") : "";
          const rawEmail = emailIndex >= 0 ? (cols[emailIndex] ?? "") : "";
          const rawSlotLimit = slotLimitIndex >= 0 ? (cols[slotLimitIndex] ?? "") : "";
          const parsedSlotLimit = parseInt(rawSlotLimit, 10);

          return {
            name: rawName,
            address: rawAddress || null,
            contact_person: rawContactPerson || null,
            contact_number: rawContactNumber || null,
            email: rawEmail || null,
            intern_slot_limit: Number.isNaN(parsedSlotLimit) ? null : parsedSlotLimit,
          };
        })
        .filter((row) => row.name.trim().length > 0);

      if (payload.length === 0) {
        alert("No valid rows found. Make sure each row has a value in the 'name' column.");
        return;
      }

      const { error: insertError } = await supabase.from("partner_agencies").insert(payload);
      if (insertError) {
        alert(insertError.message);
        return;
      }

      await fetch();
      alert(`Imported ${payload.length} agencies successfully.`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function onImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please select a CSV file.");
      e.target.value = "";
      return;
    }

    await importCsvFile(file);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partner Agencies</h1>
          <p className="text-slate-500 text-sm">Manage OJT host organizations</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportChange}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            icon={<Upload size={16} />}
            loading={importing}
          >
            Import CSV
          </Button>
          <Button onClick={openCreate} icon={<Plus size={16} />}>Add Agency</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Agency</th>
                <th className="px-4 py-3 font-semibold">Address</th>
                <th className="px-4 py-3 font-semibold">Contact Person</th>
                <th className="px-4 py-3 font-semibold">Contact Number</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Slots</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-4 py-3" colSpan={8}>
                      <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : agencies.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-400" colSpan={8}>
                    No partner agencies yet.
                  </td>
                </tr>
              ) : (
                agencies.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{a.name}</td>
                    <td className="px-4 py-3 text-slate-600">{a.address ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.contact_person ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.contact_number ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.email ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.intern_slot_limit ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(a)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          aria-label={`Edit ${a.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label={`Delete ${a.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Agency" : "Add Agency"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Agency Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          <Input label="Contact Number" type="tel" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input
            label="Intern Slot Limit"
            type="number"
            min="1"
            value={form.intern_slot_limit}
            onChange={(e) => setForm({ ...form, intern_slot_limit: e.target.value })}
            helperText="Maximum number of interns this agency can accommodate."
          />
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
