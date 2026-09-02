"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, BarChart2, X, Contact } from "lucide-react";
import { employeesApi } from "@/lib/api";

const ROLE_BADGE: Record<string, string> = {
  "Sales Executive":      "bg-blue-50 text-blue-700 border-blue-200",
  "Sales Manager":        "bg-purple-50 text-purple-700 border-purple-200",
  "Business Development": "bg-teal-50 text-teal-700 border-teal-200",
  "Support":              "bg-gray-50 text-gray-700 border-gray-200",
};
function roleBadge(r: string) { return ROLE_BADGE[r] ?? "bg-gray-50 text-gray-700 border-gray-200"; }

function targetColor(pct: number) {
  if (pct >= 100) return { bar: "bg-green-500",  text: "text-green-700" };
  if (pct >= 50)  return { bar: "bg-yellow-500", text: "text-yellow-700" };
  return              { bar: "bg-red-500",    text: "text-red-700"    };
}

function formatINR(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

function initials(name: string) { return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }

const AVATAR_COLORS = ["bg-blue-500","bg-purple-500","bg-emerald-500","bg-orange-500","bg-pink-500","bg-teal-500"];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function EditModal({
  emp, onClose, onSaved,
}: { emp: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: emp.name, email: emp.email, phone: emp.phone ?? "", role: emp.role, isActive: emp.isActive });
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    employeesApi.getEnums().then((d) => setRoles(d?.roles ?? [])).catch(() => {});
  }, []);

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim() || !form.role || saving) return;
    setSaving(true);
    setError("");
    try {
      await employeesApi.update(emp.id, { ...form, phone: form.phone || undefined });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
          <p className="font-semibold text-[#1a2035]">Edit Employee</p>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa]"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          {[
            { label: "Name *", key: "name", type: "text" },
            { label: "Email *", key: "email", type: "email" },
            { label: "Phone", key: "phone", type: "tel" },
          ].map(({ label, key, type }) => (
            <div key={key} className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none" />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-700">Role *</label>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
              <option value="">Select role</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-700">Status</label>
            <button type="button" onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? "bg-green-500" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-xs font-medium ${form.isActive ? "text-green-700" : "text-gray-400"}`}>{form.isActive ? "Active" : "Inactive"}</span>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.email.trim() || !form.role}
              className="flex-1 rounded-lg bg-[#0971fe] py-2 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button onClick={onClose} disabled={saving}
              className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa] disabled:opacity-40">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editEmp, setEditEmp]     = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await employeesApi.getAll();
      setEmployees(Array.isArray(data) ? data : []);
    } catch { setEmployees([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function flash(type: "success" | "error", text: string) {
    setMsg({ type, text }); setTimeout(() => setMsg(null), 3000);
  }

  async function handleDeactivate(id: string, current: boolean) {
    try {
      await employeesApi.update(id, { isActive: !current });
      await load();
      flash("success", current ? "Employee deactivated." : "Employee activated.");
    } catch (err: any) {
      flash("error", err?.message ?? "Failed.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await employeesApi.delete(id);
      setConfirmDelete(null);
      await load();
      flash("success", "Employee deleted.");
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to delete.");
    }
  }

  const total    = employees.length;
  const active   = employees.filter((e) => e.isActive).length;
  const totalLeads = employees.reduce((s, e) => s + (e._count?.leads ?? 0), 0);

  return (
    <div className="space-y-5">
      {editEmp && <EditModal emp={editEmp} onClose={() => setEditEmp(null)} onSaved={() => { load(); flash("success", "Employee updated."); }} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <p className="font-semibold text-[#1a2035]">Delete Employee?</p>
              <p className="mt-1 text-sm text-[#8094ae]">This action cannot be undone.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">
                  Delete
                </button>
                <button onClick={() => setConfirmDelete(null)}
                  className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2035]">Employees</h1>
          <p className="mt-0.5 text-sm text-[#8094ae]">Manage your sales team</p>
        </div>
        <Link href="/employees/new"
          className="flex items-center gap-1.5 self-start rounded-lg bg-[#0971fe] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0558d4]">
          <Plus className="h-4 w-4" />Add Employee
        </Link>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${msg.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-600"}`}>
          {msg.text}<button onClick={() => setMsg(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Employees", value: total },
          { label: "Active",          value: active },
          { label: "Leads Assigned",  value: totalLeads },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[#e5e9f2] bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-[#1a2035]">{value}</p>
            <p className="text-sm text-[#8094ae]">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#0971fe] border-t-transparent" />
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Contact className="h-10 w-10 text-[#8094ae] opacity-40" />
            <p className="text-sm text-[#8094ae]">No employees yet. Add your first team member.</p>
            <Link href="/employees/new"
              className="flex items-center gap-1.5 rounded-lg bg-[#0971fe] px-4 py-2 text-sm font-medium text-white hover:bg-[#0558d4]">
              <Plus className="h-4 w-4" />Add Employee
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f5f6fa]">
                  {["Name / Role", "Email", "Phone", "Leads", "Target Progress", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const t    = emp.currentTarget ?? {};
                  const pct  = t.percent ?? 0;
                  const tc   = targetColor(pct);
                  return (
                    <tr key={emp.id} className="border-b border-[#e5e9f2] hover:bg-[#f9fafc]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(emp.name)}`}>
                            {initials(emp.name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{emp.name}</p>
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleBadge(emp.role)}`}>
                              {emp.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[#f0f6ff] px-2.5 py-0.5 text-xs font-medium text-[#0971fe]">
                          {emp._count?.leads ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.target > 0 ? (
                          <div className="min-w-[140px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#8094ae]">{formatINR(t.achieved ?? 0)} / {formatINR(t.target)}</span>
                              <span className={`font-bold ${tc.text}`}>{pct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <div className={`h-1.5 rounded-full ${tc.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-xs text-[#8094ae]">Not set</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${emp.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {emp.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/employees/${emp.id}`} title="View Stats"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8094ae] hover:bg-[#f0f6ff] hover:text-[#0971fe]">
                            <BarChart2 className="h-3.5 w-3.5" />
                          </Link>
                          <button onClick={() => setEditEmp(emp)} title="Edit"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8094ae] hover:bg-[#f0f6ff] hover:text-[#0971fe]">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeactivate(emp.id, emp.isActive)} title={emp.isActive ? "Deactivate" : "Activate"}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${emp.isActive ? "text-yellow-600 hover:bg-yellow-50" : "text-green-600 hover:bg-green-50"}`}>
                            {emp.isActive ? "✕" : "✓"}
                          </button>
                          <button onClick={() => setConfirmDelete(emp.id)} title="Delete"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8094ae] hover:bg-red-50 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
