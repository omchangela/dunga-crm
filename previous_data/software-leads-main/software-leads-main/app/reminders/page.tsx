"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle2, Circle, Clock, FileText, Phone, Tag, X, CalendarDays } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
          <div>
            <p className="font-semibold text-[#1a2035]">{title || (isEdit ? "Reschedule Reminder" : "Set Reminder")}</p>
            <p className="text-xs text-[#8094ae]">{leadName}</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa] disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Reminder Date &amp; Time</label>
            <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} disabled={isSaving}
              className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none disabled:bg-gray-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Note <span className="font-normal text-[#8094ae]">(optional)</span>
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={isSaving}
              placeholder="Add a note for this reminder…" rows={3}
              className="w-full resize-none rounded-lg border border-[#e5e9f2] px-3 py-2 text-sm text-gray-700 placeholder:text-[#b0bac9] focus:border-[#0971fe] focus:outline-none disabled:bg-gray-100" />
          </div>
          <div className="flex gap-2">
            <button disabled={!dt || isSaving}
              onClick={() => { if (dt) onSave(new Date(dt).toISOString(), note.trim()); }}
              className="flex-1 rounded-lg bg-[#0971fe] py-2 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
              {isSaving ? "Saving..." : (title || (isEdit ? "Update Reminder" : "Add Reminder"))}
            </button>
            <button onClick={onClose} disabled={isSaving}
              className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa] disabled:opacity-50">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
              <div>
                <p className="font-semibold text-[#1a2035]">{viewLead?.fullName ?? "—"}</p>
                <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  viewReminder.status === "DONE" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                }`}>
                  {viewReminder.status === "DONE" ? "Done" : "Pending"}
                </span>
              </div>
              <button onClick={() => setViewId(null)} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              {[
                { icon: <Phone className="h-4 w-4" />, label: "Phone",        value: viewLead?.phone ?? "—" },
                { icon: <Tag className="h-4 w-4" />,   label: "Project Name", value: viewLead?.loanType || "—" },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f6fa] text-[#8094ae]">{icon}</div>
                  <div>
                    <p className="text-xs text-[#8094ae]">{label}</p>
                    <p className="text-sm font-medium text-[#1a2035]">{value}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f6fa] text-[#8094ae]">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-[#8094ae]">Reminder Date</p>
                  <p className="text-sm font-medium text-[#1a2035]">{formatDateTime(viewReminder.reminderAt)}</p>
                </div>
              </div>
              {viewReminder.note && viewReminder.note !== "Follow up" && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f6fa] text-[#8094ae]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-[#8094ae]">Note</p>
                    <p className="mt-0.5 rounded-lg bg-[#f5f6fa] px-3 py-2 text-sm text-[#1a2035]">{viewReminder.note}</p>
                  </div>
                </div>
              )}
              {viewLead && (
                <div className="pt-1">
                  <Link href={`/leads/${viewLead.id}`} onClick={() => setViewId(null)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] px-3 py-2 text-xs font-medium text-[#0971fe] hover:bg-[#f0f6ff]">
                    View Lead →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Toast */}
        {toast && (
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}>
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
            {toast.text}
            <button onClick={() => setToast(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title="Reminders" subtitle="Follow-up reminders across all leads." />
          <span className="flex items-center gap-1.5 rounded-xl border border-[#e5e9f2] bg-white px-3 py-2 text-sm text-[#8094ae] shadow-sm">
            <Bell className="h-4 w-4" />
            <span className="font-medium text-[#1a2035]">{pendingCount}</span>
            pending reminder{pendingCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: "followup",   label: "Follow Up",        count: counts.followup },
            { key: "unfollowup", label: "Un-Follow Up",     count: counts.unfollowup },
            { key: "missed",     label: "Missed Reminders", count: counts.missed },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-[#0971fe] bg-[#0971fe] text-white"
                  : "border-[#e5e9f2] bg-white text-[#8094ae] hover:bg-[#f5f6fa]"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                tab === t.key ? "bg-white/20 text-white" : "bg-[#f5f6fa] text-[#8094ae]"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm">
          {loading ? (
            <ListSkeleton rows={6} />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f5f6fa]">
                  {["#", "Lead / Client", "Project Name", "Reminder Date & Note", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Bell className="mx-auto mb-3 h-10 w-10 text-[#8094ae]" />
                      <p className="text-sm text-[#8094ae]">No reminders in this tab.</p>
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
                        className={`cursor-pointer border-b border-[#e5e9f2] transition-colors hover:bg-[#f9fafc] ${isDone ? "opacity-60" : ""}`}
                      >
                        {/* # */}
                        <td className="px-4 py-3 text-sm font-medium text-[#0971fe]">
                          {String(idx + 1).padStart(2, "0")}
                        </td>

                        {/* Lead */}
                        <td className="px-4 py-3">
                          {lead ? (
                            <Link href={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()}
                              className="block hover:text-[#0971fe]">
                              <p className={`font-medium text-[#1a2035] hover:underline ${isDone ? "line-through" : ""}`}>
                                {lead.fullName}
                              </p>
                              <p className="text-xs text-[#8094ae]">{lead.phone}</p>
                            </Link>
                          ) : (
                            <p className="text-[#8094ae]">—</p>
                          )}
                        </td>

                        {/* Project Name */}
                        <td className="px-4 py-3 text-[#8094ae]">
                          <p>{lead?.loanType || "—"}</p>
                          {lead?.projectType && (
                            <p className="text-xs text-[#b0bac9]">{lead.projectType}</p>
                          )}
                        </td>

                        {/* Date & Note */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className={`whitespace-nowrap text-sm ${
                                overdue ? "font-semibold text-red-600" : "text-[#1a2035]"
                              }`}>
                                {formatDateTime(r.reminderAt)}
                              </p>
                              {overdue && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Overdue</span>}
                              <Badge variant={r.isReReminder ? "review" : "outline"}>
                                {r.isReReminder ? "Re-Reminder" : "Reminder"}
                              </Badge>
                            </div>
                            
                            {/* Visual Timeline Details */}
                            <div className="mt-1.5 space-y-1 font-mono text-xs text-[#526484]">
                              {r.isReReminder && r.parentReminder ? (
                                <>
                                  <div className="flex items-start">
                                    <span className="text-[#8094ae] mr-1.5 shrink-0">├─</span>
                                    <p className="text-xs text-gray-500">
                                      <span className="font-semibold text-gray-600">Based on:</span> {r.parentReminder.note || "No note"} ({formatDateTime(r.parentReminder.reminderAt)})
                                    </p>
                                  </div>
                                  <div className="flex items-start">
                                    <span className="text-[#8094ae] mr-1.5 shrink-0">└─</span>
                                    <p className="text-sm font-sans text-[#1a2035]">
                                      {r.note || "No note"}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-start">
                                  <span className="text-[#8094ae] mr-1.5 shrink-0">├─</span>
                                  <p className="text-sm font-sans text-[#1a2035]">
                                    {r.note || "No note"}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                              <CheckCircle2 className="h-3 w-3" />Done
                            </span>
                          ) : overdue ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                              <Clock className="h-3 w-3" />Overdue
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                              <Clock className="h-3 w-3" />Pending
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {/* Follow Up / Un-Follow Up toggle */}
                            {lead && (
                              followUp ? (
                                <button onClick={() => handleToggleFollowUp(lead.id)}
                                  className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                                  Un-Follow Up
                                </button>
                              ) : (
                                <button onClick={() => handleToggleFollowUp(lead.id)}
                                  className="rounded-md border border-[#e5e9f2] bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]">
                                  Follow Up
                                </button>
                              )
                            )}

                            {/* Re-Reminder Button */}
                            {!isDone && (
                              <button 
                                onClick={() => setReReminderModal({ 
                                  id: r.id, 
                                  leadName: lead?.fullName || "—", 
                                  currentDt: r.reminderAt, 
                                  currentNote: r.note 
                                })}
                                className="inline-flex items-center gap-1 rounded-md border border-[#e5e9f2] bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa] hover:text-[#0971fe]"
                              >
                                <CalendarDays className="h-3.5 w-3.5" />
                                Re-Reminder
                              </button>
                            )}

                            {/* Explicit Completed Button */}
                            {!isDone && (
                              <button onClick={() => handleMarkDone(r.id)} 
                                className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                                <Circle className="h-3 w-3" />
                                Completed
                              </button>
                            )}

                            {/* Delete */}
                            <button onClick={() => handleDelete(r.id)} title="Delete"
                              className="rounded-lg p-1.5 text-[#8094ae] hover:bg-red-50 hover:text-red-500">
                              <X className="h-3.5 w-3.5" />
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