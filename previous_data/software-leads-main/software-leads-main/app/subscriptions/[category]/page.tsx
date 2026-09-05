"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Check, AlertCircle, ArrowLeft,
  Globe, Server, Shield, Wrench, Package, Calendar, RefreshCw, IndianRupee, X, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fetchSubscriptions, fetchSubscriptionEnums, subscriptionsApi, fetchAllProjects } from "@/lib/api";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import type { Subscription } from "@/lib/store";
import { formatDate } from "@/lib/utils";

type Category = Subscription["category"];

const SLUG_MAP: Record<string, Category> = {
  domain:      "Domain",
  hosting:     "Hosting",
  ssl:         "SSL",
  maintenance: "Maintenance",
  software:    "Software Subscription",
};

const CAT_META: Record<Category, {
  icon: React.ElementType; color: string; bg: string;
  border: string; barColor: string; desc: string;
}> = {
  "Domain":                { icon: Globe,   color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   barColor: "bg-blue-500",   desc: "Domain registrations & renewals"         },
  "Hosting":               { icon: Server,  color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", barColor: "bg-purple-500", desc: "Web hosting & server plans"              },
  "SSL":                   { icon: Shield,  color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  barColor: "bg-green-500",  desc: "SSL certificates & security"             },
  "Maintenance":           { icon: Wrench,  color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", barColor: "bg-orange-500", desc: "Website maintenance & support contracts"  },
  "Software Subscription": { icon: Package, color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", barColor: "bg-indigo-500", desc: "SaaS tools & software licenses"           },
};

// Fallbacks used until /api/subscriptions/enums responds.
const BILLING_CYCLES = ["Monthly", "Quarterly", "Yearly"] as const;
const STATUSES       = ["Active", "Expired", "Cancelled"] as const;

const STATUS_COLOR: Record<string, string> = {
  Active:    "bg-green-100 text-green-700 border-green-200",
  Expired:   "bg-red-100 text-red-600 border-red-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

// Compute a renewal date from a billing cycle, counting forward from `from`.
function renewalFromCycle(cycle: string, from: Date = new Date()): string {
  const d = new Date(from);
  if (cycle === "Monthly")        d.setMonth(d.getMonth() + 1);
  else if (cycle === "Quarterly") d.setMonth(d.getMonth() + 3);
  else if (cycle === "Yearly")    d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const emptyForm = {
  name: "", projectId: "", description: "", amount: "",
  billingCycle: "Monthly" as Subscription["billingCycle"],
  renewalDate: renewalFromCycle("Monthly"), status: "Active" as Subscription["status"],
};

export default function SubscriptionCategoryPage() {
  const params   = useParams();
  const router   = useRouter();
  const slug     = (params.category as string) ?? "";
  const category = SLUG_MAP[slug] as Category | undefined;

  const [subs,      setSubs]      = useState<Subscription[]>([]);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(emptyForm);
  const [formErr,   setFormErr]   = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [billingOpts, setBillingOpts] = useState<string[]>([...BILLING_CYCLES]);
  const [statusOpts,  setStatusOpts]  = useState<string[]>([...STATUSES]);
  const [projects,    setProjects]    = useState<any[]>([]);

  function load() {
    setLoading(true);
    fetchSubscriptions().then(setSubs).catch(() => setSubs([])).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetchSubscriptionEnums()
      .then((en) => {
        if (en.billingCycles.length) setBillingOpts(en.billingCycles);
        if (en.statuses.length)       setStatusOpts(en.statuses);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAllProjects({ limit: "1000" })
      .then((res) => setProjects(res.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-bold text-[#1a2035]">Category not found</p>
        <button onClick={() => router.push("/subscriptions")} className="mt-3 text-sm text-[#0971fe] hover:underline">
          ← Back to Subscriptions
        </button>
      </div>
    );
  }

  const meta     = CAT_META[category];
  const Icon     = meta.icon;
  const catSubs  = subs.filter((s) => s.category === category);

  const activeCount  = catSubs.filter((s) => s.status === "Active").length;
  const totalMonthly = catSubs.filter((s) => s.status === "Active").reduce((sum, s) => {
    const amt = Number(s.amount);
    if (s.billingCycle === "Monthly")   return sum + amt;
    if (s.billingCycle === "Quarterly") return sum + amt / 3;
    if (s.billingCycle === "Yearly")    return sum + amt / 12;
    return sum;
  }, 0);
  const renewingSoon = catSubs.filter((s) => {
    if (s.status !== "Active") return false;
    const days = (new Date(s.renewalDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, renewalDate: renewalFromCycle("Monthly") });
    setFormErr("");
    setShowForm(true);
  }

  function openEdit(sub: Subscription) {
    setEditingId(sub.id);
    setForm({
      name: sub.name, projectId: (sub as any).projectId ?? "", description: sub.description,
      amount: String(sub.amount), billingCycle: sub.billingCycle,
      renewalDate: sub.renewalDate, status: sub.status,
    });
    setFormErr("");
    setShowForm(true);
  }

  function cancelForm() { setShowForm(false); setEditingId(null); setFormErr(""); }

  async function handleSave() {
    if (!category) return;
    if (!form.projectId)                                                        { setFormErr("Project is required."); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) { setFormErr("Enter a valid amount."); return; }
    if (!form.renewalDate)                                                      { setFormErr("Renewal date is required."); return; }
    const body = {
      name:         form.name.trim(),
      projectId:    form.projectId,
      description:  form.description.trim(),
      category,
      amount:       Number(form.amount),
      billingCycle: form.billingCycle,
      renewalDate:  form.renewalDate,
      status:       form.status,
    };
    try {
      if (editingId) await subscriptionsApi.update(editingId, body);
      else           await subscriptionsApi.create(body);
      cancelForm();
      await load();
    } catch (err: any) {
      setFormErr(err?.message ?? "Failed to save subscription.");
    }
  }

  async function handleDelete(subId: string) {
    try {
      await subscriptionsApi.delete(subId);
    } catch (err) {
      console.error("Failed to delete subscription:", err);
    }
    setDeleteId(null);
    await load();
  }

  return (
    <div className="space-y-6">

      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/subscriptions")}
          className="mb-3 flex items-center gap-1.5 text-sm text-[#8094ae] hover:text-[#0971fe] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />Back to Subscriptions
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${meta.bg} ${meta.border}`}>
              <Icon className={`h-6 w-6 ${meta.color}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1a2035]">{category}</h1>
              <p className="text-sm text-[#8094ae]">{meta.desc}</p>
            </div>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Add
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`rounded-xl border p-4 shadow-sm ${meta.bg} ${meta.border}`}>
          <p className={`text-[11px] font-medium uppercase tracking-wider ${meta.color}`}>Total</p>
          <p className={`mt-1 text-2xl font-bold ${meta.color}`}>{catSubs.length}</p>
          <p className="mt-0.5 text-[11px] text-[#8094ae]">{activeCount} active</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wider text-blue-600">Monthly Cost</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">₹{Math.round(totalMonthly).toLocaleString("en-IN")}</p>
          <p className="mt-0.5 text-[11px] text-blue-500">₹{Math.round(totalMonthly * 12).toLocaleString("en-IN")} yearly</p>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${renewingSoon > 0 ? "border-orange-200 bg-orange-50" : "border-[#e5e9f2] bg-white"}`}>
          <p className={`text-[11px] font-medium uppercase tracking-wider ${renewingSoon > 0 ? "text-orange-600" : "text-[#8094ae]"}`}>Renewing Soon</p>
          <p className={`mt-1 text-2xl font-bold ${renewingSoon > 0 ? "text-orange-600" : "text-[#1a2035]"}`}>{renewingSoon}</p>
          <p className="mt-0.5 text-[11px] text-[#8094ae]">within 30 days</p>
        </div>
      </div>

      {/* Subscription cards */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : catSubs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d0d5e8] bg-white py-16 text-center">
          <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border ${meta.bg} ${meta.border}`}>
            <Icon className={`h-7 w-7 ${meta.color} opacity-50`} />
          </div>
          <p className="text-sm font-semibold text-[#1a2035]">No {category} subscriptions yet</p>
          <p className="mt-1 text-xs text-[#8094ae]">Add your first subscription to track it here</p>
          <Button size="sm" className="mt-4" onClick={openAdd}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Add Subscription
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catSubs.map((sub) => {
            const isDel    = deleteId === sub.id;
            const daysLeft = Math.ceil((new Date(sub.renewalDate).getTime() - Date.now()) / 86400000);
            const renewing = sub.status === "Active" && daysLeft >= 0 && daysLeft <= 30;
            // Past the renewal date and not cancelled → expired / payment due.
            const expired  = sub.status !== "Cancelled" && daysLeft < 0;
            const lastPaidAt = (sub as any).lastPaidAt as string | undefined;

            return (
              <div
                key={sub.id}
                className={`overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${
                  renewing ? "border-orange-200" : "border-[#e5e9f2]"
                } bg-white`}
              >
                {/* Colored top bar */}
                <div className={`h-1 w-full ${meta.barColor}`} />

                {/* Card header */}
                <div className="flex items-start justify-between px-4 pt-4 pb-2">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate text-[14px] font-bold text-[#1a2035]">
                      {(sub as any).projectName || sub.name}
                    </p>
                    {(sub as any).customerName && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[#8094ae]">
                        <User className="h-3 w-3 shrink-0" />{(sub as any).customerName}
                      </p>
                    )}
                    {sub.description && (
                      <p className="mt-0.5 truncate text-[11px] text-[#8094ae]">{sub.description}</p>
                    )}
                  </div>
                  {isDel ? (
                    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                      <span className="text-[10px] text-red-600">Delete?</span>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-600"
                      >Yes</button>
                      <button onClick={() => setDeleteId(null)} className="text-[10px] text-red-400 hover:text-red-600">No</button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 gap-0.5">
                      <button onClick={() => openEdit(sub)} className="rounded p-1.5 text-[#8094ae] hover:bg-[#f0f6ff] hover:text-[#0971fe] transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(sub.id)} className="rounded p-1.5 text-[#8094ae] hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Info tiles 2×2 */}
                <div className="grid grid-cols-2 gap-2 px-4 pb-2">
                  <div className="rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <IndianRupee className="h-3 w-3 text-[#8094ae]" />
                      <span className="text-[9px] font-medium uppercase tracking-wide text-[#8094ae]">Amount</span>
                    </div>
                    <p className="text-sm font-bold text-[#1a2035]">
                      {Number(sub.amount) === 0 ? "Free" : `₹${Number(sub.amount).toLocaleString("en-IN")}`}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <RefreshCw className="h-3 w-3 text-[#8094ae]" />
                      <span className="text-[9px] font-medium uppercase tracking-wide text-[#8094ae]">Billing</span>
                    </div>
                    <p className="text-sm font-bold text-[#1a2035]">{sub.billingCycle}</p>
                  </div>

                  <div className={`rounded-lg border px-3 py-2 ${renewing ? "border-orange-200 bg-orange-50" : "border-[#e5e9f2] bg-[#f8f9fc]"}`}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <Calendar className={`h-3 w-3 ${renewing ? "text-orange-500" : "text-[#8094ae]"}`} />
                      <span className={`text-[9px] font-medium uppercase tracking-wide ${renewing ? "text-orange-500" : "text-[#8094ae]"}`}>Renewal</span>
                    </div>
                    <p className={`text-xs font-bold ${renewing ? "text-orange-700" : "text-[#1a2035]"}`}>
                      {formatDate(sub.renewalDate)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                    <p className="text-[9px] font-medium uppercase tracking-wide text-[#8094ae] mb-1">Status</p>
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[sub.status]}`}>
                      {sub.status}
                    </span>
                  </div>
                </div>

                {/* Expired (payment due) — takes priority over the renewing-soon hint */}
                {expired ? (
                  <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    <p className="text-[11px] font-medium text-red-700">
                      Expired {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? "s" : ""} ago — payment due
                    </p>
                  </div>
                ) : renewing ? (
                  <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-100 px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-orange-600" />
                    <p className="text-[11px] font-medium text-orange-700">
                      Renews in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                    </p>
                  </div>
                ) : null}

                {/* Paid-at indicator */}
                {lastPaidAt && (
                  <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    <p className="text-[11px] font-medium text-green-700">Paid at: {formatDate(lastPaidAt)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e9f2] px-6 py-4">
              <p className="text-base font-bold text-[#1a2035]">
                {editingId ? "Edit" : "Add"} {category}
              </p>
              <button onClick={cancelForm} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f0f6ff] hover:text-[#0971fe]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Project Name *</Label>
                  <Select
                    value={form.projectId}
                    onChange={(e) => {
                      const proj = projects.find((p) => p.id === e.target.value);
                      setForm((p) => ({
                        ...p,
                        projectId: e.target.value,
                        // Keep the display name in sync with the selected project.
                        name: proj ? (proj.projectName || proj.headline || "") : "",
                      }));
                    }}
                  >
                    <option value="">Select project…</option>
                    {/* Preserve a current selection that isn't in the fetched list (e.g. on edit) */}
                    {form.projectId && !projects.some((p) => p.id === form.projectId) && (
                      <option value={form.projectId}>{form.name || "Current project"}</option>
                    )}
                    {projects.map((p) => {
                      const pn = p.projectName || p.headline || "Untitled project";
                      return <option key={p.id} value={p.id}>{pn}</option>;
                    })}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Amount (₹) *</Label>
                  <Input type="number" min="0" placeholder="0"
                    value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Billing Cycle</Label>
                  <Select
                    value={form.billingCycle}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        billingCycle: e.target.value as any,
                        // Auto-generate the renewal date from the chosen cycle.
                        renewalDate: renewalFromCycle(e.target.value),
                      }))
                    }
                  >
                    {billingOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Renewal Date *</Label>
                  <Input type="date" value={form.renewalDate}
                    onChange={(e) => setForm((p) => ({ ...p, renewalDate: e.target.value }))} />
                  <p className="text-[10px] text-[#8094ae]">Auto-set from billing cycle — adjust if needed.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}>
                    {statusOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Description (optional)</Label>
                  <Input placeholder="Notes"
                    value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e5e9f2] px-6 py-4">
              <Button variant="outline" size="sm" onClick={cancelForm}>Cancel</Button>
              <Button size="sm" onClick={handleSave}><Check className="mr-1.5 h-3.5 w-3.5" />Save</Button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
