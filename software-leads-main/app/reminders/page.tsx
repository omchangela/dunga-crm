"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle2, Circle, Clock, FileText, Phone, Tag, X, CalendarDays, AlertTriangle, ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { fetchReminders, remindersApi, leadsApi } from "@/lib/api";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Tab = "followup" | "unfollowup" | "missed";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(iso: string) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function toDateTimeLocal(iso: string) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

function isPastDue(iso: string) {
  return new Date(iso) < new Date();
}

function ReminderModal({
  leadName, initialDt, initialNote, onSave, onClose, isEdit = false, isSaving = false, title
}: { 
  leadName: string; 
  initialDt?: string;
  initialNote?: string;
  onSave: (iso: string, note: string) => void; 
  onClose: () => void;
  isEdit?: boolean;
  isSaving?: boolean;
  title?: string;
}) {
  const defaultVal = () => {
    if (initialDt) return toDateTimeLocal(initialDt);
    const dt = new Date(); dt.setHours(dt.getHours() + 1, 0, 0, 0);
    return toDateTimeLocal(dt.toISOString());
  };
  const [dt, setDt]     = useState(defaultVal);
  const [note, setNote] = useState(initialNote === "Follow up" ? "" : (initialNote ?? ""));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{title || (isEdit ? "Reschedule Reminder" : "Set Reminder")}</p>
            <p className="text-xs text-slate-500">{leadName}</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Reminder Date &amp; Time</label>
            <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} disabled={isSaving}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={isSaving}
              placeholder="Add a note for this reminder…" rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:opacity-50" />
          </div>
          <div className="flex gap-2 pt-2">
            <button disabled={!dt || isSaving}
              onClick={() => { if (dt) onSave(new Date(dt).toISOString(), note.trim()); }}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : (title || (isEdit ? "Update Reminder" : "Add Reminder"))}
            </button>
            <button onClick={onClose} disabled={isSaving}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RemindersPage() {
  const [reminders, setReminders]       = useState<any[]>([]);
  const [leadsMap, setLeadsMap]         = useState<Record<string, any>>({});
  const [tab, setTab]                   = useState<Tab>("followup");
  const [toast, setToast]               = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading]           = useState(true);

  // Modal controlled updates
  const [reReminderModal, setReReminderModal] = useState<{ id: string; leadName: string; currentDt: string; currentNote: string } | null>(null);
  const [isSavingReReminder, setIsSavingReReminder] = useState(false);

  // View modal
  const [viewId, setViewId] = useState<string | null>(null);

  // Set-reminder modal
  const [reminderModal, setReminderModal] = useState<{ leadId: string; leadName: string } | null>(null);

  async function load() {
    try {
      const { reminders: all } = await fetchReminders();
      const map: Record<string, any> = {};
      all.forEach((r) => { if (r.lead) map[r.leadId] = r.lead; });
      setLeadsMap(map);
      setReminders(all);
    } catch (err: any) {
      showToast("error", err?.message ?? "Failed to load reminders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }

  const visible = reminders.filter((r) => r.status !== "DONE");
  const isFollowUp = (r: any) => !!(r.lead?.followUp);

  const counts = {
    followup:    visible.filter(isFollowUp).length,
    unfollowup: visible.filter((r) => !isFollowUp(r)).length,
    missed:     visible.filter((r) => isPastDue(r.reminderAt)).length,
  };

  const tabFiltered = visible.filter((r) => {
    if (tab === "followup")   return isFollowUp(r);
    if (tab === "unfollowup") return !isFollowUp(r);
    return isPastDue(r.reminderAt);
  });

  const pendingCount = visible.length;

  async function handleToggleFollowUp(leadId: string) {
    try {
      await leadsApi.toggleFollowUp(leadId);
      await load();
      showToast("success", "Follow-up updated.");
    } catch (err: any) {
      showToast("error", err?.message ?? "Failed to update follow-up.");
    }
  }

  async function handleSaveReminder(leadId: string, iso: string, note: string) {
    try {
      await remindersApi.create(leadId, { reminderAt: iso, note: note || "Follow up" });
      setReminderModal(null);
      await load();
      showToast("success", "Reminder set.");
    } catch (err: any) {
      showToast("error", err?.message ?? "Failed to set reminder.");
    }
  }

  async function handleSaveReReminder(id: string, iso: string, note: string) {
    setIsSavingReReminder(true);
    try {
      await remindersApi.createReReminder(id, {
        reminderAt: iso,
        note: note,
      });
      setReReminderModal(null);
      await load();
      showToast("success", "Re-reminder created successfully");
    } catch (err: any) {
      showToast("error", err?.message ?? "Failed to create re-reminder.");
    } finally {
      setIsSavingReReminder(false);
    }
  }

  async function handleMarkDone(id: string) {
    try {
      await remindersApi.markDone(id);
      await load();
      showToast("success", "Reminder marked as completed.");
    } catch (err: any) {
      showToast("error", err?.message ?? "Failed to complete reminder.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await remindersApi.delete(id);
      await load();
      showToast("success", "Reminder deleted.");
    } catch (err: any) {
      showToast("error", err?.message ?? "Failed to delete reminder.");
    }
  }

  const viewReminder = viewId ? reminders.find((r) => r.id === viewId) ?? null : null;
  const viewLead     = viewReminder ? leadsMap[viewReminder.leadId] : null;

  return (
    <>
      {/* Set Reminder Modal */}
      {reminderModal && (
        <ReminderModal
          leadName={reminderModal.leadName}
          onSave={(iso, note) => handleSaveReminder(reminderModal.leadId, iso, note)}
          onClose={() => setReminderModal(null)}
        />
      )}

      {/* Re-Reminder Modal */}
      {reReminderModal && (
        <ReminderModal
          title="Re-Reminder"
          leadName={reReminderModal.leadName}
          initialDt={reReminderModal.currentDt}
          initialNote={reReminderModal.currentNote}
          isSaving={isSavingReReminder}
          onSave={(iso, note) => handleSaveReReminder(reReminderModal.id, iso, note)}
          onClose={() => setReReminderModal(null)}
        />
      )}

      {/* Detail Modal */}
      {viewReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{viewLead?.fullName ?? "—"}</p>
                <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  viewReminder.status === "DONE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40"
                }`}>
                  {viewReminder.status === "DONE" ? "Completed" : "Pending"}
                </span>
              </div>
              <button onClick={() => setViewId(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {[
                { icon: <Phone className="h-4 w-4 text-blue-500" />, label: "Phone",        value: viewLead?.phone ?? "—" },
                { icon: <Tag className="h-4 w-4 text-purple-500" />,   label: "Project Name", value: viewLead?.loanType || viewLead?.serviceType || "—" },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">{icon}</div>
                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase">{label}</p>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">{value}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase">Reminder Date</p>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">{formatDateTime(viewReminder.reminderAt)}</p>
                </div>
              </div>
              {viewReminder.note && viewReminder.note !== "Follow up" && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    <FileText className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase">Note</p>
                    <p className="mt-1 rounded-2xl bg-slate-50 dark:bg-slate-800 p-3 text-xs font-medium text-slate-800 dark:text-slate-200">{viewReminder.note}</p>
                  </div>
                </div>
              )}
              {viewLead && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Link href={`/leads/${viewLead.id}`} onClick={() => setViewId(null)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400">
                    View Associated Lead <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8 pb-10">

        {/* ══ HERO BANNER ══ */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
                <Bell className="h-3.5 w-3.5 text-blue-300" />
                Scheduled Tasks & Alerts
                <span className="opacity-40">•</span>
                {pendingCount} Pending Reminders
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                Follow-Up Reminders
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Action items, scheduled client calls, and timeline follow-ups across all leads.
              </p>
            </div>
          </div>
        </section>

        {/* ══ TOP METRIC KPI CARDS ══ */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              label: "Pending Reminders",
              value: pendingCount,
              sub: "Scheduled Action Items",
              icon: Bell,
              color: "from-blue-600 to-indigo-600",
            },
            {
              label: "Follow-Up Pipeline",
              value: counts.followup,
              sub: "Active Scheduled Calls",
              icon: Clock,
              color: "from-amber-600 to-orange-600",
            },
            {
              label: "Overdue Alerts",
              value: counts.missed,
              sub: "Action Required Immediately",
              icon: AlertTriangle,
              color: "from-rose-600 to-pink-600",
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
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</p>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-600/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </section>

        {/* Toast */}
        {toast && (
          <div className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 text-xs font-bold ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
          }`}>
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />}
            {toast.text}
            <button onClick={() => setToast(null)} className="ml-auto"><X className="h-4 w-4 opacity-60 hover:opacity-100" /></button>
          </div>
        )}

        {/* ══ REMINDERS CONTAINER ══ */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          
          {/* Header & Tabs */}
          <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
              {([
                { key: "followup",   label: "Follow Up",        count: counts.followup },
                { key: "unfollowup", label: "Un-Follow Up",     count: counts.unfollowup },
                { key: "missed",     label: "Missed / Overdue", count: counts.missed },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    tab === t.key
                      ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-none ${
                    tab === t.key ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60" : "bg-slate-200/70 text-slate-500 dark:bg-slate-700"
                  }`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <ListSkeleton rows={6} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold">
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">Lead / Client</th>
                    <th className="py-3.5 px-4">Project Category</th>
                    <th className="py-3.5 px-4">Scheduled Date & Note</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tabFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <Bell className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                        <p className="text-xs font-bold text-slate-500">No reminders in this tab.</p>
                      </td>
                    </tr>
                  ) : (
                    tabFiltered.map((r, idx) => {
                      const lead      = leadsMap[r.leadId];
                      const isDone    = r.status === "DONE";
                      const overdue   = !isDone && isPastDue(r.reminderAt);
                      const followUp  = !!lead?.followUp;

                      return (
                        <tr
                          key={r.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("button, input, textarea")) return;
                            setViewId(r.id);
                          }}
                          className={`cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${isDone ? "opacity-60" : ""}`}
                        >
                          <td className="py-3.5 px-4 font-black text-blue-600 dark:text-blue-400">
                            {String(idx + 1).padStart(2, "0")}
                          </td>

                          <td className="py-3.5 px-4">
                            {lead ? (
                              <Link href={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()}
                                className="block hover:text-blue-600">
                                <p className={`font-extrabold text-slate-900 dark:text-white hover:underline ${isDone ? "line-through" : ""}`}>
                                  {lead.fullName}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium">{lead.phone}</p>
                              </Link>
                            ) : (
                              <p className="text-slate-400">—</p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                            <p>{lead?.loanType || lead?.serviceType || "—"}</p>
                            {lead?.projectType && (
                              <p className="text-[11px] text-slate-400 font-medium">{lead.projectType}</p>
                            )}
                          </td>

                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`whitespace-nowrap font-bold ${
                                  overdue ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
                                }`}>
                                  {formatDateTime(r.reminderAt)}
                                </p>
                                {overdue && <span className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 text-[10px] font-extrabold uppercase">Overdue</span>}
                              </div>
                              
                              {r.note && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium line-clamp-2">
                                  "{r.note}"
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {isDone ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />Done
                              </span>
                            ) : overdue ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 text-xs font-bold dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                                <Clock className="h-3 w-3" />Overdue
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-bold dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                                <Clock className="h-3 w-3" />Pending
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {lead && (
                                followUp ? (
                                  <button onClick={() => handleToggleFollowUp(lead.id)}
                                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                                    Un-Follow Up
                                  </button>
                                ) : (
                                  <button onClick={() => handleToggleFollowUp(lead.id)}
                                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                                    Follow Up
                                  </button>
                                )
                              )}

                              {!isDone && (
                                <button 
                                  onClick={() => setReReminderModal({ 
                                    id: r.id, 
                                    leadName: lead?.fullName || "—", 
                                    currentDt: r.reminderAt, 
                                    currentNote: r.note 
                                  })}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                                >
                                  <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                                  Reschedule
                                </button>
                              )}

                              {!isDone && (
                                <button onClick={() => handleMarkDone(r.id)} 
                                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  Mark Done
                                </button>
                              )}

                              <button onClick={() => handleDelete(r.id)} title="Delete"
                                className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}