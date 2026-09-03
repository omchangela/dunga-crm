"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, BarChart2, X, Contact, Users, UserCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { employeesApi } from "@/lib/api";

const ROLE_BADGE: Record<string, string> = {
  "Sales Executive":      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  "Sales Manager":        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
  "Business Development": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300",
  "Support":              "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
};
function roleBadge(r: string) { return ROLE_BADGE[r] ?? "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"; }

function targetColor(pct: number) {
  if (pct >= 100) return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" };
  if (pct >= 50)  return { bar: "bg-amber-500",   text: "text-amber-700 dark:text-amber-400" };
  return              { bar: "bg-rose-500",    text: "text-rose-700 dark:text-rose-400"    };
}

function formatINR(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

function initials(name: string) { if (!name) return "EM"; return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }

const AVATAR_COLORS = [
  "bg-gradient-to-br from-blue-600 to-indigo-700",
  "bg-gradient-to-br from-violet-600 to-purple-700",
  "bg-gradient-to-br from-emerald-600 to-teal-700",
  "bg-gradient-to-br from-amber-600 to-orange-700",
  "bg-gradient-to-br from-rose-600 to-pink-700",
  "bg-gradient-to-br from-cyan-600 to-blue-700",
];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <p className="font-bold text-slate-900 dark:text-white">Edit Employee Details</p>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          {[
            { label: "Full Name *", key: "name", type: "text" },
            { label: "Email Address *", key: "email", type: "email" },
            { label: "Phone Number", key: "phone", type: "tel" },
          ].map(({ label, key, type }) => (
            <div key={key} className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Sales Role *</label>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
              <option value="">Select role</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Account Status</label>
            <button type="button" onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-xs font-bold ${form.isActive ? "text-emerald-600" : "text-slate-400"}`}>{form.isActive ? "Active" : "Inactive"}</span>
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.email.trim() || !form.role}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 disabled:opacity-40">
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
    <div className="space-y-8 pb-10">
      {editEmp && <EditModal emp={editEmp} onClose={() => setEditEmp(null)} onSaved={() => { load(); flash("success", "Employee updated."); }} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="p-6">
              <p className="font-bold text-slate-900 dark:text-white text-base">Delete Employee Account?</p>
              <p className="mt-1 text-xs text-slate-500">This action will remove the team member and unassign associated leads.</p>
              <div className="mt-6 flex gap-2">
                <button onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 shadow-md">
                  Delete Account
                </button>
                <button onClick={() => setConfirmDelete(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
              <Contact className="h-3.5 w-3.5 text-blue-300" />
              Sales Team Directory
              <span className="opacity-40">•</span>
              {total} Employees Registered
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Sales & BD Team Hub
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Manage sales executives, business development targets, and lead assignments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/employees/new"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-95">
              <Plus className="h-4 w-4" />
              Add Employee
            </Link>
          </div>
        </div>
      </section>

      {/* ══ TOP METRIC KPI CARDS ══ */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Sales Team",
            value: total,
            sub: "Registered Team Members",
            icon: Contact,
            color: "from-blue-600 to-indigo-600",
          },
          {
            label: "Active Executives",
            value: active,
            sub: "Active Pipeline Handlers",
            icon: UserCheck,
            color: "from-emerald-600 to-teal-600",
          },
          {
            label: "Total Leads Assigned",
            value: totalLeads,
            sub: "Assigned Across Team",
            icon: Users,
            color: "from-indigo-600 to-purple-600",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
              </span>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-md shadow-slate-300/50 dark:shadow-none transition group-hover:scale-110`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-3">
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {value}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{sub}</p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-600/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </section>

      {msg && (
        <div className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 text-xs font-bold ${msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"}`}>
          {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />}
          {msg.text}<button onClick={() => setMsg(null)} className="ml-auto"><X className="h-4 w-4 opacity-60 hover:opacity-100" /></button>
        </div>
      )}

      {/* ══ EMPLOYEES DATA TABLE CONTAINER ══ */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 dark:border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Showing <span className="font-extrabold text-slate-900 dark:text-white">{employees.length}</span> team members
          </p>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Contact className="h-12 w-12 text-slate-300" />
            <p className="text-xs font-bold text-slate-500">No sales team members registered yet.</p>
            <Link href="/employees/new"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md">
              <Plus className="h-4 w-4" />Add Employee
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold">
                  <th className="py-3.5 px-4">Name / Role</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4 text-center">Leads Assigned</th>
                  <th className="py-3.5 px-4">Target Progress</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees.map((emp) => {
                  const t    = emp.currentTarget ?? {};
                  const pct  = t.percent ?? 0;
                  const tc   = targetColor(pct);
                  return (
                    <tr key={emp.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarColor(emp.name)}`}>
                            {initials(emp.name)}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 dark:text-white text-sm">{emp.name}</p>
                            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${roleBadge(emp.role)}`}>
                              {emp.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-400">{emp.email}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-400">{emp.phone ?? "—"}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-xs font-extrabold text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                          {emp._count?.leads ?? 0} Leads
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {t.target > 0 ? (
                          <div className="min-w-[140px] space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-500">{formatINR(t.achieved ?? 0)} / {formatINR(t.target)}</span>
                              <span className={tc.text}>{pct}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div className={`h-2 rounded-full ${tc.bar} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-xs font-medium text-slate-400">Target not set</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          emp.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${emp.isActive ? "bg-emerald-400" : "bg-slate-400"}`} />
                          {emp.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/employees/${emp.id}`} title="View Stats"
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600">
                            <BarChart2 className="h-4 w-4" />
                          </Link>
                          <button onClick={() => setEditEmp(emp)} title="Edit"
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeactivate(emp.id, emp.isActive)} title={emp.isActive ? "Deactivate" : "Activate"}
                            className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${emp.isActive ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40" : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"}`}>
                            {emp.isActive ? "✕" : "✓"}
                          </button>
                          <button onClick={() => setConfirmDelete(emp.id)} title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                            <Trash2 className="h-4 w-4" />
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
