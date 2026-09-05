"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, IndianRupee, Check, X, ExternalLink, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { financeApi, fetchProject, fetchSubscriptions, subscriptionsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

const PAYMENT_MODES = ["UPI", "Bank Transfer", "Cash", "Cheque", "Other"];

const PROJ_STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700 border border-amber-200",
  CONVERTED: "bg-blue-100 text-blue-700 border border-blue-200",
  REJECTED:  "bg-rose-100 text-rose-700 border border-rose-200",
  ACTIVE:    "bg-blue-100 text-blue-700 border border-blue-200",
  COMPLETED: "bg-green-100 text-green-700 border border-green-200",
  ON_HOLD:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
  CANCELLED: "bg-red-100 text-red-700 border border-red-200",
};

function projStatusLabel(s: string) {
  return s === "CONVERTED" ? "ACTIVE" : s;
}

const emptyForm = {
  amount: "",
  paymentMethod: "UPI",
  paymentDate: new Date().toISOString().slice(0, 10),
  transactionId: "",
  note: "",
  scheduleId: "",
};

export default function ProjectFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projId } = use(params);

  const [project, setProject] = useState<any>(null);
  const [projectDetail, setProjectDetail] = useState<any>(null);
  const [summary, setSummary] = useState<any>({ totalBudget: 0, totalPaid: 0, remainingBalance: 0 });
  const [payments, setPayments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payModal, setPayModal] = useState<{ subId: string; subName: string; amount: string; date: string; method: string; note: string } | null>(null);
  const [payErr, setPayErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

async function loadFinanceLedger() {
    try {
      // Cast to any to bypass strict return-type inference that lacks 'schedules'
      const dynamicPayload = (await financeApi.projectLedger(projId)) as any;
      setProject(dynamicPayload.project);
      setSummary(dynamicPayload.summary);
      setPayments(dynamicPayload.history ?? []);
      setSchedules(dynamicPayload.schedules ?? []);
      fetchProject(projId).then(setProjectDetail).catch(() => {});
      fetchSubscriptions({ limit: "1000", projectId: projId })
        .then((res) => setSubscriptions(res.filter((s: any) => s.projectId === projId)))
        .catch(() => {});
    } catch (err) {
      console.error("Critical tracking anomaly:", err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  useEffect(() => { if (projId) loadFinanceLedger(); }, [projId]);

  // Record a subscription renewal payment and refresh the ledger.
  async function handleMarkPaid() {
    if (!payModal) return;
    if (!payModal.amount || isNaN(Number(payModal.amount)) || Number(payModal.amount) <= 0) {
      setPayErr("Enter a valid amount.");
      return;
    }
    try {
      const res = await subscriptionsApi.markPaid(payModal.subId, {
        amount: Number(payModal.amount),
        paymentDate: payModal.date,
        paymentMethod: payModal.method,
        note: payModal.note,
      });
      const nextRenewal = res?.data?.subscription?.renewalDate;
      setPayModal(null);
      setPayErr("");
      showToast(nextRenewal ? `Payment recorded. Renewal advanced to ${formatDate(nextRenewal)}.` : "Payment recorded.");
      await loadFinanceLedger();
    } catch (err: any) {
      setPayErr(err?.message ?? "Failed to mark as paid.");
    }
  }

  const budget = summary.totalBudget;
  const paid = summary.totalPaid;
  const pending = summary.remainingBalance;
  const pct = budget > 0 ? Math.min(100, Math.round((paid / budget) * 100)) : 0;

  function validateForm(f: typeof emptyForm) {
    if (!f.amount || isNaN(Number(f.amount)) || Number(f.amount) <= 0) return "Enter a valid currency amount.";
    if (!f.paymentDate) return "Transaction reference date is required.";
    return "";
  }

  async function handleAdd() {
    const err = validateForm(addForm);
    if (err) { setAddError(err); return; }

    try {
      const response = await financeApi.collect({ projectId: projId, ...addForm });
      
      if (response.allocations && response.allocations.length > 0) {
        const allocationMsg = response.allocations
          .map((a: any) => `₹${Number(a.applied).toLocaleString("en-IN")} → ${a.description} (${a.scheduleNow.status === 'paid' ? 'Paid' : 'Partial'})`)
          .join(", ");
        showToast(allocationMsg);
      }
      
      if (response.remaining && response.remaining > 0) {
        setTimeout(() => {
          showToast(`₹${Number(response.remaining).toLocaleString("en-IN")} not allocated (no pending schedules)`);
        }, 5100);
      }
      
      setAddForm(emptyForm);
      setShowAdd(false);
      setAddError("");
      loadFinanceLedger();
    } catch (e: any) {
      setAddError(e?.message || "Failed to log transaction.");
    }
  }

  function startEdit(pay: any) {
    setDeleteId(null);
    setEditingId(pay.id);
    setEditError("");
    setEditForm({
      amount:         String(pay.amount ?? ""),
      paymentMethod: pay.paymentMethod ?? "UPI",
      paymentDate:   pay.paymentDate ? String(pay.paymentDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      transactionId: pay.transactionId ?? "",
      note:          pay.note ?? "",
      scheduleId:    "",
    });
  }

  async function handleEditSave(transactionId: string) {
    try {
      await financeApi.updateTransaction(transactionId, {
        paymentMethod: editForm.paymentMethod,
        paymentDate: editForm.paymentDate,
        transactionId: editForm.transactionId,
        note: editForm.note,
      });
      setEditingId(null);
      setEditError("");
      showToast("Transaction metadata updated successfully");
      loadFinanceLedger();
    } catch (e: any) {
      if (e?.message?.includes("amount")) {
        setEditError("Cannot change amount. Delete and recreate transaction instead.");
      } else {
        setEditError(e?.message || "Failed to update transaction.");
      }
    }
  }

  async function handleDelete(transactionId: string) {
    try {
      await financeApi.deleteTransaction(transactionId);
      setDeleteId(null);
      showToast("Transaction deleted, schedules reverted");
      loadFinanceLedger();
    } catch (e: any) {
      console.error("Failed to delete transaction:", e);
      showToast("Failed to delete transaction");
    }
  }

  const availableSchedules = schedules.filter((s: any) => 
    s.status === "pending" || s.status === "partial"
  );

  if (loading) return (
    <div className="space-y-6 p-1">
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <ListSkeleton rows={4} />
      </div>
    </div>
  );

  if (!project) return <div className="flex items-center justify-center py-20 text-sm text-slate-500">Selected accounting track doesn't exist inside db record clusters.</div>;

  function renderScheduleStatus(schedule: any) {
    const payment = Number(schedule.payment || 0);
    const paid = Number(schedule.paid || 0);
    const status = schedule.status || "pending";
    
    if (status === "paid") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">Paid</span>;
    }
    if (status === "partial") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-700">
        Partial (₹{paid.toLocaleString("en-IN")}/₹{payment.toLocaleString("en-IN")})
      </span>;
    }
    return <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">Pending</span>;
  }

  return (
    <div className="space-y-6 p-1">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right">
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-lg">
            <p className="text-sm font-medium text-green-800">{toast}</p>
          </div>
        </div>
      )}

      {/* Structural Action Subnav header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-lg">
            <Link href="/finances"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">{project.projectName}</h1>
            <p className="text-xs text-slate-500 font-medium">Customer reference signature: {project.customer?.fullName || "—"}</p>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto gap-2 text-xs font-semibold">
          <Link href={`/projects/${project.id}`}>
            <ExternalLink className="h-3.5 w-3.5" /> Core Structural View
          </Link>
        </Button>
      </div>

      {/* Numerical Telemetry Dash tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Gross Budget Profile</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">₹{budget.toLocaleString("en-IN")}</p>
          <div className="mt-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PROJ_STATUS_COLOR[projStatusLabel(project.status)] ?? "bg-slate-100 text-slate-600"}`}>
              {projStatusLabel(project.status)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Liquid Payments Logged</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-800">₹{paid.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-emerald-600/80 font-medium">{payments.length} discrete operations processed</p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Pending Escrow Gap</p>
          <p className="mt-2 text-2xl font-extrabold text-orange-800">₹{pending.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-orange-600/80 font-medium">Remaining outstanding dynamic margin</p>
        </div>
      </div>

      {/* Recurring subscription income (kept separate from project budget/paid) */}
      {Number(summary.totalSubscriptionPaid) > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 px-5 py-3 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Subscription Paid · recurring</span>
          <span className="text-lg font-extrabold text-indigo-800">₹{Number(summary.totalSubscriptionPaid).toLocaleString("en-IN")}</span>
        </div>
      )}

      {/* Dynamic Visual Graph Track */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 uppercase tracking-wide">Liquidation Framework Progress</span>
          <span className="font-extrabold text-emerald-700 text-sm">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Main Grid: Clean, structured 2-Column Split */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">

        {/* Left Component: Takes 2 Column Units */}
        <Card className="shadow-sm border-slate-200 overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">Transactional Operations Ledger</CardTitle>
              <CardDescription className="text-xs">Immutable processing stream audit trails</CardDescription>
            </div>
            <Button size="sm" className="text-xs font-semibold gap-1.5" onClick={() => { setShowAdd(true); setAddForm(emptyForm); setAddError(""); }}>
              <Plus className="h-4 w-4" /> Log Transaction
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-6">

            {/* Add transaction wrapper panel */}
            {showAdd && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-4">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Configure Inbound Collection Item</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">Payment Schedule (optional hint)</Label>
                    <select 
                      value={addForm.scheduleId} 
                      onChange={(e) => setAddForm((p) => ({ ...p, scheduleId: e.target.value }))}
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                    >
                      <option value="">-- No schedule selected (backend allocates sequentially) --</option>
                      {availableSchedules.map((sch: any) => {
                        const payment = Number(sch.payment || 0);
                        const paid = Number(sch.paid || 0);
                        const due = payment - paid;
                        return (
                          <option key={sch.id} value={sch.id} className="text-xs text-slate-900">
                            {sch.description} (₹{due.toLocaleString("en-IN")} due)
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">This is a UI hint only. Backend always allocates payments sequentially.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">Processed Value (₹) *</Label>
                    <Input type="number" placeholder="0.00" className="bg-white shadow-none" value={addForm.amount} onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">Functional Channel Mode</Label>
                    <select 
                      value={addForm.paymentMethod} 
                      onChange={(e) => setAddForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m} className="text-xs text-slate-900">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">Settlement Frame Timestamp *</Label>
                    <Input type="date" className="bg-white shadow-none text-xs" value={addForm.paymentDate} onChange={(e) => setAddForm((p) => ({ ...p, paymentDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">Internal Reference/Transaction ID</Label>
                    <Input placeholder="e.g. TXN-190238120" className="bg-white shadow-none" value={addForm.transactionId} onChange={(e) => setAddForm((p) => ({ ...p, transactionId: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">Payment Notes</Label>
                    <Input placeholder="Milestone, retainer, or upfront engineering advances..." className="bg-white shadow-none" value={addForm.note} onChange={(e) => setAddForm((p) => ({ ...p, note: e.target.value }))} />
                  </div>
                </div>
                {addError && <p className="text-xs font-semibold text-rose-600">{addError}</p>}
                <div className="flex gap-2 justify-end pt-2">
                  <Button size="sm" variant="outline" className="text-xs font-semibold" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button size="sm" className="text-xs font-semibold" onClick={handleAdd}>Commit Entry</Button>
                </div>
              </div>
            )}

            {/* Core Ledger Entries List */}
            {payments.length === 0 && !showAdd ? (
              <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                <CalendarDays className="h-10 w-10 stroke-[1.5] opacity-40" />
                <p className="text-xs font-medium">No system settlement ledger points located.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-none">
                {payments.map((pay) => (
                  editingId === pay.id ? (
                    <div key={pay.id} className="bg-blue-50/40 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Edit Collection Item</p>
                        <p className="text-[10px] text-orange-600 font-medium">Amount cannot be changed. Delete & recreate to change amount.</p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-400">Processed Value (₹) - Read Only</Label>
                          <Input type="number" className="bg-slate-100 shadow-none text-slate-500 cursor-not-allowed" value={editForm.amount} disabled />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">Functional Channel Mode</Label>
                          <select value={editForm.paymentMethod} onChange={(e) => setEditForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400">
                            {PAYMENT_MODES.map((m) => <option key={m} value={m} className="text-xs text-slate-900">{m}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">Settlement Frame Timestamp *</Label>
                          <Input type="date" className="bg-white shadow-none text-xs" value={editForm.paymentDate} onChange={(e) => setEditForm((p) => ({ ...p, paymentDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">Internal Reference/Transaction ID</Label>
                          <Input className="bg-white shadow-none" value={editForm.transactionId} onChange={(e) => setEditForm((p) => ({ ...p, transactionId: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">Payment Notes</Label>
                          <Input className="bg-white shadow-none" value={editForm.note} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} />
                        </div>
                      </div>
                      {editError && <p className="text-xs font-semibold text-rose-600">{editError}</p>}
                      <div className="flex gap-2 justify-end pt-1">
                        <Button size="sm" variant="outline" className="text-xs font-semibold" onClick={() => { setEditingId(null); setEditError(""); }}>Cancel</Button>
                        <Button size="sm" className="text-xs font-semibold" onClick={() => handleEditSave(pay.id)}>Save Changes</Button>
                      </div>
                    </div>
                  ) : (
                    <div key={pay.id} className="bg-white flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <IndianRupee className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center flex-wrap gap-2">
                          <p className="text-sm font-bold text-slate-900">₹{Number(pay.amount).toLocaleString("en-IN")}</p>
                          <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                            {pay.paymentMethod}
                          </span>
                          {/* Source badge — distinguishes one-time project payments from recurring subscription income */}
                          {pay.source === "SUBSCRIPTION" ? (
                            <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                              Subscription
                            </span>
                          ) : (
                            <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                              Project
                            </span>
                          )}
                          {pay.transactionId && (
                            <span className="text-[11px] font-mono font-medium text-slate-400">({pay.transactionId})</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {new Date(pay.paymentDate).toLocaleDateString("en-IN")}
                          {pay.note && <span className="text-slate-400"> · {pay.note}</span>}
                        </p>
                      </div>

                      {deleteId === pay.id ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[11px] font-medium text-slate-500">Delete?</span>
                          <button onClick={() => handleDelete(pay.id)} className="rounded-md bg-rose-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-600">Yes</button>
                          <button onClick={() => setDeleteId(null)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50">No</button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => startEdit(pay)} title="Edit" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => { setEditingId(null); setDeleteId(pay.id); }} title="Delete" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Component: Constrained & Sticky Clean Viewport */}
        {(() => {
          const pd = projectDetail ?? project;
          const planned   = pd?.payments  ?? [];
          const features  = pd?.costHistory ?? [];
          const schedules = pd?.schedules ?? [];
          const base      = Number(pd?.budget ?? 0);
          const total     = Number(pd?.totalProjectCost ?? base);
          return (
            <div className="space-y-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-40px)] lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              {/* Payment Breakdown Card */}
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                    <IndianRupee className="h-4 w-4 text-[#0971fe]" /> Payment Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-5">
                  {planned.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payments</p>
                      {planned.map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                          <span className="text-sm text-slate-700">{p.description || "Payment"}</span>
                          <span className="text-sm font-semibold text-slate-800">₹{Number(p.amount || 0).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-600">Base Project Cost</span>
                    <span className="text-sm font-bold text-slate-800">₹{base.toLocaleString("en-IN")}</span>
                  </div>

                  {features.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Feature Additions</p>
                      {features.map((c: any, i: number) => (
                        <div key={c.id ?? i} className="flex items-center justify-between rounded-lg border border-blue-50 bg-blue-50/50 px-4 py-2.5">
                          <span className="text-sm text-slate-700">{c.label}</span>
                          <span className="text-sm font-semibold text-[#0971fe]">+₹{Number(c.amount || 0).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-xl bg-[#0971fe] px-4 py-3">
                    <span className="text-sm font-semibold text-white">Total Project Cost</span>
                    <span className="text-base font-bold text-white">₹{total.toLocaleString("en-IN")}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Schedules Card */}
              {schedules.length > 0 && (
                <Card className="shadow-sm border-slate-200 overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                      <CalendarDays className="h-4 w-4 text-indigo-600" /> Payment Schedules
                    </CardTitle>
                    <CardDescription className="text-xs">Track payment milestones and progress</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    {schedules.map((s: any, i: number) => {
                      const payment = Number(s.payment || 0);
                      const paid = Number(s.paid || 0);
                      const remaining = payment - paid;
                      const progress = payment > 0 ? Math.min(100, Math.round((paid / payment) * 100)) : 0;
                      
                      return (
                        <div key={s.id || i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-800">{s.description || "—"}</span>
                            {renderScheduleStatus(s)}
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
                              <p className="font-bold text-slate-700">₹{payment.toLocaleString("en-IN")}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">Paid</p>
                              <p className="font-bold text-emerald-700">₹{paid.toLocaleString("en-IN")}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Remaining</p>
                              <p className="font-bold text-orange-700">₹{remaining.toLocaleString("en-IN")}</p>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-slate-500">Progress</span>
                              <span className="font-bold text-emerald-600">{progress}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div 
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500" 
                                style={{ width: `${progress}%` }} 
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
              {/* Active Subscriptions Card */}
              {subscriptions.length > 0 && (
                <Card className="shadow-sm border-slate-200 overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                      <IndianRupee className="h-4 w-4 text-emerald-600" /> Active Subscriptions
                    </CardTitle>
                    <CardDescription className="text-xs">Manage project subscriptions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    {subscriptions.map((sub: any) => (
                      <div key={sub.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-800">{sub.name}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                            {sub.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Amount</p>
                            <p className="font-bold text-slate-700">₹{Number(sub.amount || 0).toLocaleString("en-IN")}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Billing</p>
                            <p className="font-bold text-slate-700">{sub.billingCycle}</p>
                          </div>
                          <div className="space-y-0.5 col-span-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Renewal</p>
                            <p className="font-bold text-orange-700">{formatDate(sub.renewalDate)}</p>
                          </div>
                          {sub.lastPaidAt && (
                            <div className="space-y-0.5 col-span-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-500">Last paid</p>
                              <p className="font-bold text-green-700">{formatDate(sub.lastPaidAt)}</p>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="w-full text-xs font-semibold bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setPayModal({ subId: sub.id, subName: sub.name, amount: String(sub.amount), date: new Date().toISOString().slice(0, 10), method: "UPI", note: "Subscription renewal" })}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" /> Mark as Paid
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })()}

      </div>

      {/* Mark Paid modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e9f2] px-6 py-4">
              <p className="text-base font-bold text-[#1a2035]">Mark Paid</p>
              <button onClick={() => { setPayModal(null); setPayErr(""); }} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f0f6ff] hover:text-[#0971fe]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Date</Label>
                <Input type="date" value={payModal.date} onChange={(e) => setPayModal((p) => p ? { ...p, date: e.target.value } : null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹)</Label>
                <Input type="number" value={payModal.amount} onChange={(e) => setPayModal((p) => p ? { ...p, amount: e.target.value } : null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Method</Label>
                <select
                  value={payModal.method}
                  onChange={(e) => setPayModal((p) => p ? { ...p, method: e.target.value } : null)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                >
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Note (optional)</Label>
                <Input value={payModal.note} onChange={(e) => setPayModal((p) => p ? { ...p, note: e.target.value } : null)} />
              </div>
              {payErr && <p className="text-xs text-red-500">{payErr}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e5e9f2] px-6 py-4">
              <Button variant="outline" size="sm" onClick={() => { setPayModal(null); setPayErr(""); }}>Cancel</Button>
              <Button size="sm" onClick={handleMarkPaid} className="bg-green-600 hover:bg-green-700 text-white"><Check className="mr-1.5 h-3.5 w-3.5" />Confirm Payment</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}