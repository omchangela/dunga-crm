"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, Check, AlertCircle, ArrowLeft,
  Globe, Server, Shield, Wrench, Package, Calendar, RefreshCw, IndianRupee, X, User,
  CheckCircle2, CreditCard, Clock, AlertTriangle,
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
  border: string; barColor: string; desc: string; addLabel: string;
}> = {
  "Domain":                { icon: Globe,   color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   border: "border-blue-200/80 dark:border-blue-800/40",   barColor: "bg-blue-600",   desc: "Domain registrations & renewal schedules",         addLabel: "Add Domain" },
  "Hosting":               { icon: Server,  color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200/80 dark:border-purple-800/40", barColor: "bg-purple-600", desc: "Web hosting servers, VPS, & cloud infrastructure", addLabel: "Add Hosting Plan" },
  "SSL":                   { icon: Shield,  color: "text-emerald-600 dark:text-emerald-400",  bg: "bg-emerald-50 dark:bg-emerald-950/40",  border: "border-emerald-200/80 dark:border-emerald-800/40",  barColor: "bg-emerald-600",  desc: "SSL security certificates & encryption renewals",   addLabel: "Add SSL Certificate" },
  "Maintenance":           { icon: Wrench,  color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200/80 dark:border-amber-800/40", barColor: "bg-amber-600", desc: "Website maintenance, SLA retainers, & support", addLabel: "Add Maintenance Contract" },
  "Software Subscription": { icon: Package, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200/80 dark:border-indigo-800/40", barColor: "bg-indigo-600", desc: "SaaS software tools & third-party software licenses", addLabel: "Add Software License" },
};

const BILLING_CYCLES = ["Monthly", "Quarterly", "Yearly"] as const;
const STATUSES       = ["Active", "Expired", "Cancelled"] as const;

const STATUS_COLOR: Record<string, string> = {
  Active:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  Expired:   "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  Cancelled: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
};

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
        <p className="text-base font-extrabold text-slate-900 dark:text-white">Category not found</p>
        <button onClick={() => router.push("/subscriptions")} className="mt-3 text-xs font-bold text-blue-600 hover:underline">
          ← Back to Subscriptions Hub
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
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5">
          <Link
            href="/subscriptions"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md border border-white/15 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to All Subscriptions
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${meta.bg} ${meta.border} shadow-lg`}>
                <Icon className={`h-7 w-7 ${meta.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                    {category} Subscriptions
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-0.5 text-xs font-extrabold text-blue-200 border border-white/15">
                    {catSubs.length} Active Plans
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  {meta.desc}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                {meta.addLabel}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TOP METRIC KPI CARDS ══ */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: `Total ${category} Subscriptions`,
            value: catSubs.length,
            sub: `${activeCount} Active Status`,
            icon: Icon,
            color: "from-blue-600 to-indigo-600",
          },
          {
            label: "Monthly Cost Burden",
            value: `₹${Math.round(totalMonthly).toLocaleString("en-IN")}`,
            sub: `₹${Math.round(totalMonthly * 12).toLocaleString("en-IN")} Estimated Yearly`,
            icon: IndianRupee,
            color: "from-emerald-600 to-teal-600",
          },
          {
            label: "Renewals (30 Days)",
            value: renewingSoon,
            sub: "Requires Action / Payment",
            icon: Clock,
            color: "from-amber-600 to-orange-600",
          },
        ].map(({ label, value, sub, icon: KIcon, color }) => (
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
                <KIcon className="h-5 w-5" />
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

      {/* ══ SUBSCRIPTION CARDS GRID ══ */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : catSubs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200/80 bg-white p-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ${meta.bg} ${meta.border}`}>
            <Icon className={`h-8 w-8 ${meta.color} opacity-60`} />
          </div>
          <p className="text-base font-extrabold text-slate-900 dark:text-white">No {category} subscriptions recorded</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Register your first subscription to track renewal deadlines and billing.</p>
          <button onClick={openAdd} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700">
            <Plus className="h-4 w-4" />{meta.addLabel}
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {catSubs.map((sub) => {
            const isDel    = deleteId === sub.id;
            const daysLeft = Math.ceil((new Date(sub.renewalDate).getTime() - Date.now()) / 86400000);
            const renewing = sub.status === "Active" && daysLeft >= 0 && daysLeft <= 30;
            const expired  = sub.status !== "Cancelled" && daysLeft < 0;
            const lastPaidAt = (sub as any).lastPaidAt as string | undefined;

            return (
              <div
                key={sub.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className={`h-1.5 w-full ${meta.barColor}`} />

                <div className="flex flex-col gap-4 p-6">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate text-base font-extrabold text-slate-900 dark:text-white">
                        {(sub as any).projectName || sub.name}
                      </p>
                      {(sub as any).customerName && (
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-semibold text-slate-400">
                          <User className="h-3.5 w-3.5 shrink-0 text-blue-500" />{(sub as any).customerName}
                        </p>
                      )}
                      {sub.description && (
                        <p className="mt-1 truncate text-xs text-slate-500 font-medium">{sub.description}</p>
                      )}
                    </div>

                    {isDel ? (
                      <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1">
                        <span className="text-[11px] font-bold text-rose-600">Delete?</span>
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="rounded-lg bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-rose-700"
                        >Yes</button>
                        <button onClick={() => setDeleteId(null)} className="text-[11px] font-bold text-slate-500 hover:text-slate-700">No</button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => openEdit(sub)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteId(sub.id)} className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Amount</span>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {Number(sub.amount) === 0 ? "Free" : `₹${Number(sub.amount).toLocaleString("en-IN")}`}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Billing</span>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{sub.billingCycle}</p>
                    </div>

                    <div className={`rounded-2xl border p-3 ${renewing ? "border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800" : "border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50"}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${renewing ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>Renewal</span>
                      <p className={`text-xs font-extrabold ${renewing ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white"}`}>
                        {formatDate(sub.renewalDate)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50 flex flex-col justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Status</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${STATUS_COLOR[sub.status]}`}>
                        {sub.status}
                      </span>
                    </div>
                  </div>

                  {expired ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2 dark:bg-rose-950/40 dark:border-rose-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                      <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        Expired {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? "s" : ""} ago
                      </p>
                    </div>
                  ) : renewing ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2 dark:bg-amber-950/40 dark:border-amber-800">
                      <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        Renews in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                      </p>
                    </div>
                  ) : null}

                  {lastPaidAt && (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 dark:bg-emerald-950/40 dark:border-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Paid at: {formatDate(lastPaidAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {editingId ? "Edit" : "Add"} {category} Record
              </p>
              <button onClick={cancelForm} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Target Project *</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => {
                      const proj = projects.find((p) => p.id === e.target.value);
                      setForm((p) => ({
                        ...p,
                        projectId: e.target.value,
                        name: proj ? (proj.projectName || proj.headline || "") : "",
                      }));
                    }}
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">Select project...</option>
                    {form.projectId && !projects.some((p) => p.id === form.projectId) && (
                      <option value={form.projectId}>{form.name || "Current project"}</option>
                    )}
                    {projects.map((p) => {
                      const pn = p.projectName || p.headline || "Untitled project";
                      return <option key={p.id} value={p.id}>{pn}</option>;
                    })}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Billing Amount (₹) *</label>
                  <input type="number" min="0" placeholder="0"
                    value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Billing Cycle</label>
                  <select
                    value={form.billingCycle}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        billingCycle: e.target.value as any,
                        renewalDate: renewalFromCycle(e.target.value),
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                  >
                    {billingOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Renewal Date *</label>
                  <input type="date" value={form.renewalDate}
                    onChange={(e) => setForm((p) => ({ ...p, renewalDate: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                    {statusOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Description (optional)</label>
                  <input placeholder="Notes"
                    value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
                </div>
              </div>
              {formErr && <p className="text-xs font-bold text-rose-600">{formErr}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
              <button onClick={handleSave} className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md">
                Save Record
              </button>
              <button onClick={cancelForm} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
