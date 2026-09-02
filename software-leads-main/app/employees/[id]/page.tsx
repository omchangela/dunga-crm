"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Target, X } from "lucide-react";
import { employeesApi } from "@/lib/api";

const ROLE_BADGE: Record<string, string> = {
  "Sales Executive":      "bg-blue-50 text-blue-700 border-blue-200",
  "Sales Manager":        "bg-purple-50 text-purple-700 border-purple-200",
  "Business Development": "bg-teal-50 text-teal-700 border-teal-200",
  "Support":              "bg-gray-50 text-gray-700 border-gray-200",
};
function roleBadge(r: string) { return ROLE_BADGE[r] ?? "bg-gray-50 text-gray-700 border-gray-200"; }

function targetColor(pct: number) {
  if (pct >= 100) return { bar: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50  border-green-200"  };
  if (pct >= 75)  return { bar: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50   border-blue-200"   };
  if (pct >= 50)  return { bar: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  return              { bar: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50    border-red-200"    };
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
          <p className="font-semibold text-[#1a2035]">Set Monthly Target</p>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa]"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Month</label>
              <select value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: Number(e.target.value) }))}
                className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: Number(e.target.value) }))}
                className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-700">Target (₹)</label>
            <input type="number" min="1" value={form.target} placeholder="e.g. 200000"
              onChange={(e) => { setForm((p) => ({ ...p, target: e.target.value })); setError(""); }}
              className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-lg bg-[#0971fe] py-2 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
              {saving ? "Saving…" : "Save Target"}
            </button>
            <button onClick={onClose} disabled={saving}
              className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa]">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
          <p className="font-semibold text-[#1a2035]">Edit Employee</p>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa]"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          {[["name","Name *","text"],["email","Email *","email"],["phone","Phone","tel"]].map(([key,label,type]) => (
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
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-lg bg-[#0971fe] py-2 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button onClick={onClose} disabled={saving}
              className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa]">
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
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0971fe] border-t-transparent" />
    </div>
  );
  if (!stats) return <div className="py-20 text-center text-sm text-[#8094ae]">Employee not found.</div>;

  const emp    = stats.employee ?? {};
  const target = stats.target   ?? {};
  const leads  = stats.leads    ?? {};
  const tc     = targetColor(target.percent ?? 0);

  return (
    <div className="space-y-6">
      {showTarget && <SetTargetModal empId={id} onClose={() => setShowTarget(false)} onSaved={() => { load(); flash("Target updated."); }} />}
      {showEdit   && <EditModal emp={emp} onClose={() => setShowEdit(false)} onSaved={() => { load(); flash("Employee updated."); }} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-2xl">
            <p className="font-semibold text-[#1a2035]">Delete Employee?</p>
            <p className="mt-1 text-sm text-[#8094ae]">This cannot be undone.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={handleDelete} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{toast}</div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/employees" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e9f2] bg-white text-[#8094ae] hover:bg-[#f5f6fa]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#1a2035]">{emp.name}</h1>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleBadge(emp.role)}`}>{emp.role}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${emp.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                {emp.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-[#8094ae]">{emp.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]">
            <Pencil className="h-3.5 w-3.5" />Edit
          </button>
          <button onClick={() => setShowTarget(true)} className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]">
            <Target className="h-3.5 w-3.5" />Set Target
          </button>
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100">
            <Trash2 className="h-3.5 w-3.5" />Delete
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Leads",    value: leads.total     ?? 0 },
          { label: "Pending",        value: leads.pending   ?? 0 },
          { label: "Converted",      value: leads.converted ?? 0 },
          { label: "Customers",      value: stats.customers ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[#e5e9f2] bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-[#1a2035]">{value}</p>
            <p className="text-sm text-[#8094ae]">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Target card */}
        <div className={`rounded-xl border p-5 ${tc.bg}`}>
          <div className="mb-4 flex items-center justify-between">
            <span className={`text-sm font-bold ${tc.text}`}>
              {target.month ? `${MONTH_NAMES[target.month - 1]} ${target.year}` : "Current Month"} Target
            </span>
            <button onClick={() => setShowTarget(true)}
              className="flex items-center gap-1 rounded-lg border border-current/20 px-2.5 py-1 text-xs font-medium hover:bg-white/40">
              <Target className="h-3 w-3" />Set Target
            </button>
          </div>
          {target.target > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[["Target", target.target], ["Achieved", target.achieved], ["Remaining", target.remaining]].map(([lbl, val]) => (
                  <div key={lbl as string}>
                    <p className="text-xs text-[#8094ae]">{lbl}</p>
                    <p className={`font-bold ${tc.text}`}>{formatINR(val as number)}</p>
                  </div>
                ))}
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/60">
                <div className={`h-3 rounded-full transition-all ${tc.bar}`} style={{ width: `${Math.min(target.percent ?? 0, 100)}%` }} />
              </div>
              <p className={`mt-1.5 text-right text-xs font-bold ${tc.text}`}>{target.percent ?? 0}%</p>
            </>
          ) : (
            <p className="text-sm text-[#8094ae]">No target set for this month.</p>
          )}
        </div>

        {/* Info card */}
        <div className="rounded-xl border border-[#e5e9f2] bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-[#1a2035]">Employee Info</p>
          <div className="space-y-3">
            {[["Name", emp.name], ["Email", emp.email], ["Phone", emp.phone ?? "—"], ["Role", emp.role], ["Joined", emp.createdAt ? formatDate(emp.createdAt) : "—"]].map(([label, value]) => (
              <div key={label as string} className="flex items-start justify-between gap-4">
                <span className="text-xs font-medium text-[#8094ae]">{label}</span>
                <span className="text-xs font-medium text-[#1a2035]">{value as string}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Recent follow-ups */}
      <div className="rounded-xl border border-[#e5e9f2] bg-white shadow-sm">
        <div className="border-b border-[#e5e9f2] px-5 py-4">
          <p className="text-sm font-semibold text-[#1a2035]">Recent Follow-Ups</p>
        </div>
        {(stats.recentFollowUps ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#8094ae]">No follow-ups logged yet.</p>
        ) : (
          <div className="divide-y divide-[#e5e9f2]">
            {(stats.recentFollowUps ?? []).map((fu: any) => (
              <div key={fu.id} className="flex items-start gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1a2035]">{fu.lead?.fullName}</p>
                  <p className="text-xs text-[#8094ae]">{fu.lead?.phone}</p>
                  <p className="mt-1 text-xs text-gray-600">{fu.note}</p>
                </div>
                <p className="shrink-0 text-xs text-[#8094ae]">{formatDate(fu.followedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
