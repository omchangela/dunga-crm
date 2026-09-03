"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Target, X, CheckCircle2, User, Phone, Mail, Contact } from "lucide-react";
import { employeesApi } from "@/lib/api";

const ROLE_BADGE: Record<string, string> = {
  "Sales Executive":      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  "Sales Manager":        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
  "Business Development": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300",
  "Support":              "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
};
function roleBadge(r: string) { return ROLE_BADGE[r] ?? "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"; }

function targetColor(pct: number) {
  if (pct >= 100) return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800" };
  if (pct >= 75)  return { bar: "bg-blue-500",    text: "text-blue-700 dark:text-blue-400",       bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800" };
  if (pct >= 50)  return { bar: "bg-amber-500",   text: "text-amber-700 dark:text-amber-400",     bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800" };
  return              { bar: "bg-rose-500",     text: "text-rose-700 dark:text-rose-400",       bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800" };
}

function formatINR(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();

function SetTargetModal({ empId, onClose, onSaved }: { empId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), target: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSave() {
    if (!form.target || Number(form.target) <= 0 || saving) { setError("Enter a valid target amount."); return; }
    setSaving(true); setError("");
    try {
      await employeesApi.setTarget(empId, { target: Number(form.target), month: form.month, year: form.year });
      onSaved(); onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to set target.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <p className="font-bold text-slate-900 dark:text-white">Set Monthly Sales Target</p>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Month</label>
              <select value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: Number(e.target.value) }))}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: Number(e.target.value) }))}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Target Goal (₹)</label>
            <input type="number" min="1" value={form.target} placeholder="e.g. 200000"
              onChange={(e) => { setForm((p) => ({ ...p, target: e.target.value })); setError(""); }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none" />
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md">
              {saving ? "Saving..." : "Save Target"}
            </button>
            <button onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({ emp, onClose, onSaved }: { emp: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: emp.name, email: emp.email, phone: emp.phone ?? "", role: emp.role, isActive: emp.isActive });
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => { employeesApi.getEnums().then((d) => setRoles(d?.roles ?? [])).catch(() => {}); }, []);

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim() || !form.role || saving) return;
    setSaving(true); setError("");
    try {
      await employeesApi.update(emp.id, { ...form, phone: form.phone || undefined });
      onSaved(); onClose();
    } catch (err: any) { setError(err?.message ?? "Failed."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <p className="font-bold text-slate-900 dark:text-white">Edit Employee Details</p>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          {[["name","Name *","text"],["email","Email *","email"],["phone","Phone","tel"]].map(([key,label,type]) => (
            <div key={key} className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none" />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Role *</label>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none">
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
            <button type="button" onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-slate-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-xs font-bold ${form.isActive ? "text-emerald-600" : "text-slate-400"}`}>{form.isActive ? "Active" : "Inactive"}</span>
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [stats, setStats]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [showTarget, setShowTarget] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    try { setStats(await employeesApi.getStats(id)); }
    catch { setStats(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (id) load(); }, [id]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function handleDelete() {
    try {
      await employeesApi.delete(id);
      router.push("/employees");
    } catch (err: any) {
      flash(err?.message ?? "Failed to delete.");
      setConfirmDelete(false);
    }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );
  if (!stats) return <div className="py-20 text-center text-xs font-bold text-slate-400">Employee record not found.</div>;

  const emp    = stats.employee ?? {};
  const target = stats.target   ?? {};
  const leads  = stats.leads    ?? {};
  const tc     = targetColor(target.percent ?? 0);

  return (
    <div className="space-y-8 pb-10">
      {showTarget && <SetTargetModal empId={id} onClose={() => setShowTarget(false)} onSaved={() => { load(); flash("Target updated."); }} />}
      {showEdit   && <EditModal emp={emp} onClose={() => setShowEdit(false)} onSaved={() => { load(); flash("Employee updated."); }} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="font-bold text-slate-900 dark:text-white text-base">Delete Employee Account?</p>
            <p className="mt-1 text-xs text-slate-500">This action will remove the team member.</p>
            <div className="mt-6 flex gap-2">
              <button onClick={handleDelete} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 shadow-md">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5">
          <Link
            href="/employees"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md border border-white/15 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sales Team
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  {emp.name}
                </h1>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${roleBadge(emp.role)}`}>
                  {emp.role}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {emp.email} • {emp.phone || "No phone listed"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setShowTarget(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110">
                <Target className="h-4 w-4" />Set Monthly Target
              </button>
              <button onClick={() => setShowEdit(true)} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20">
                <Pencil className="h-4 w-4" />Edit Details
              </button>
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 px-3.5 py-2.5 text-xs font-bold text-rose-300 border border-rose-500/30 hover:bg-rose-500/30">
                <Trash2 className="h-4 w-4" />Delete
              </button>
            </div>
          </div>
        </div>
      </section>

      {toast && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {toast}
        </div>
      )}

      {/* Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Assigned Leads", value: leads.total ?? 0 },
          { label: "Pending Pipeline", value: leads.pending ?? 0 },
          { label: "Converted Deals", value: leads.converted ?? 0 },
          { label: "Active Customers", value: stats.customers ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Target card */}
        <div className={`rounded-3xl border p-6 space-y-4 ${tc.bg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-extrabold ${tc.text}`}>
              {target.month ? `${MONTH_NAMES[target.month - 1]} ${target.year}` : "Current Month"} Sales Goal
            </span>
            <button onClick={() => setShowTarget(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-current/20 px-3 py-1.5 text-xs font-bold hover:bg-white/40">
              <Target className="h-3.5 w-3.5" />Update Goal
            </button>
          </div>
          {target.target > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[["Monthly Goal", target.target], ["Achieved", target.achieved], ["Remaining", target.remaining]].map(([lbl, val]) => (
                  <div key={lbl as string}>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{lbl}</p>
                    <p className={`text-base font-extrabold ${tc.text}`}>{formatINR(val as number)}</p>
                  </div>
                ))}
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/60 dark:bg-slate-900/60">
                <div className={`h-3 rounded-full transition-all duration-500 ${tc.bar}`} style={{ width: `${Math.min(target.percent ?? 0, 100)}%` }} />
              </div>
              <p className={`text-right text-xs font-extrabold ${tc.text}`}>{target.percent ?? 0}% Achieved</p>
            </>
          ) : (
            <p className="text-xs font-bold text-slate-500">No monthly target configured for this executive.</p>
          )}
        </div>

        {/* Info card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
            Employee Profile
          </h2>
          <div className="space-y-3">
            {[["Full Name", emp.name], ["Email Address", emp.email], ["Phone Number", emp.phone ?? "—"], ["Sales Role", emp.role], ["Joined Date", emp.createdAt ? formatDate(emp.createdAt) : "—"]].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-400">{label}</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">{value as string}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Recent follow-ups */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Recent Pipeline Logged Follow-ups</h2>
        </div>
        {(stats.recentFollowUps ?? []).length === 0 ? (
          <p className="p-8 text-center text-xs font-bold text-slate-400">No recent follow-ups logged.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(stats.recentFollowUps ?? []).map((fu: any) => (
              <div key={fu.id} className="flex items-start gap-4 p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{fu.lead?.fullName}</p>
                  <p className="text-xs font-medium text-slate-400">{fu.lead?.phone}</p>
                  {fu.note && <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium rounded-xl bg-slate-50 dark:bg-slate-800 p-3 border border-slate-200/60 dark:border-slate-700/60">"{fu.note}"</p>}
                </div>
                <p className="shrink-0 text-xs font-semibold text-slate-400">{formatDate(fu.followedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
