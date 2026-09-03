"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, CalendarDays,
  User, CheckCircle2, Circle, Pencil, Clock, Tag, Trash2, X, UserPlus, MapPin, Layers, AlertTriangle, ArrowRight,
} from "lucide-react";
import { Button }          from "@/components/ui/button";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { formatDate } from "@/lib/utils";
import { fetchLead, fetchLeadReminders, leadsApi, remindersApi, employeesApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

function formatDateTime(iso: string) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-xs font-extrabold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function toDateTimeLocal(iso: string) {
  const dt = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

function ReminderModal({
  leadName, onSave, onClose, isSaving, title, initialDt, initialNote
}: { 
  leadName: string; 
  onSave: (iso: string, note: string) => void; 
  onClose: () => void; 
  isSaving: boolean;
  title?: string;
  initialDt?: string;
  initialNote?: string;
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
            <p className="font-bold text-slate-900 dark:text-white">{title || "Set Reminder"}</p>
            <p className="text-xs text-slate-500">{leadName}</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
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
            <button
              disabled={!dt || isSaving}
              onClick={() => { if (dt) { onSave(new Date(dt).toISOString(), note.trim()); } }}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md"
            >
              {isSaving ? "Saving..." : (title || "Add Reminder")}
            </button>
            <button onClick={onClose} disabled={isSaving}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 disabled:opacity-40">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lead, setLead]           = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showConvert, setShowConvert]     = useState(false);
  
  const [converting, setConverting]       = useState(false);
  const [isToggling, setIsToggling]       = useState(false);
  const [isDeleting, setIsDeleting]       = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const [convertedId, setConvertedId]     = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reReminderModal, setReReminderModal] = useState<{ id: string; currentDt: string; currentNote: string } | null>(null);
  const [isSavingReReminder, setIsSavingReReminder] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isAnyActionPending = converting || isToggling || isDeleting || isSavingReminder || isSavingReReminder;

  async function load() {
    try {
      const found = await fetchLead(id);
      setLead(found);
      if (found) {
        const rems = await fetchLeadReminders(id);
        setReminders(rems);
      }
    } catch {
      setLead(null);
    }
    employeesApi.getLeadFollowUps(id)
      .then((d) => setFollowUps(Array.isArray(d) ? d : []))
      .catch(() => setFollowUps([]));
  }

  useEffect(() => { if (id) load(); }, [id]);

  function flash(type: "success" | "error", text: string, ms = 3000) {
    setToast({ type, text });
    setTimeout(() => setToast(null), ms);
  }

  async function handleToggleFollowUp() {
    if (isAnyActionPending) return;
    setIsToggling(true);
    try {
      await leadsApi.toggleFollowUp(id);
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to toggle follow-up.");
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDelete() {
    if (isAnyActionPending) return;
    setIsDeleting(true);
    try {
      await leadsApi.delete(id);
      router.push("/leads");
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to delete lead.");
      setIsDeleting(false);
    }
  }

  async function handleConvert() {
    if (isAnyActionPending) return;
    setConverting(true);
    try {
      const res = await leadsApi.convertToCustomer(id);
      setConvertedId(res.data.id);
      setShowConvert(false);
      flash("success", "Lead converted to customer successfully.", 5000);
      await load();
    } catch (err: any) {
      setShowConvert(false);
      flash("error", err?.message ?? "Conversion failed.", 5000);
    } finally {
      setConverting(false);
    }
  }

  async function handleSaveReminder(iso: string, note: string) {
    if (isAnyActionPending) return;
    setIsSavingReminder(true);
    try {
      await remindersApi.create(id, { reminderAt: iso, note: note || "Follow up" });
      setShowReminderModal(false);
      await load();
      flash("success", "Reminder set.");
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to set reminder.");
    } finally {
      setIsSavingReminder(false);
    }
  }

  async function handleSaveReReminder(iso: string, note: string) {
    if (!reReminderModal || isAnyActionPending) return;
    setIsSavingReReminder(true);
    try {
      await remindersApi.createReReminder(reReminderModal.id, { reminderAt: iso, note: note });
      setReReminderModal(null);
      await load();
      flash("success", "Re-reminder created successfully");
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to create re-reminder.");
    } finally {
      setIsSavingReReminder(false);
    }
  }

  if (!lead) return <div className="flex items-center justify-center py-20 text-xs font-bold text-slate-400">Lead record not found.</div>;

  return (
    <>
    {showConvert && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
            <p className="font-bold text-slate-900 dark:text-white">Convert Lead to Customer</p>
            <button onClick={() => setShowConvert(false)} disabled={converting}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-6">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Are you sure you want to convert this lead into an active customer account?</p>
            <div className="mt-6 flex gap-2">
              <button onClick={handleConvert} disabled={converting}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md">
                {converting ? "Converting..." : "Confirm Conversion"}
              </button>
              <button onClick={() => setShowConvert(false)} disabled={converting}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 disabled:opacity-40">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {showReminderModal && (
      <ReminderModal
        leadName={lead.fullName}
        onSave={handleSaveReminder}
        onClose={() => setShowReminderModal(false)}
        isSaving={isSavingReminder}
      />
    )}

    {reReminderModal && (
      <ReminderModal
        title="Re-Reminder"
        leadName={lead.fullName}
        initialDt={reReminderModal.currentDt}
        initialNote={reReminderModal.currentNote}
        onSave={handleSaveReReminder}
        onClose={() => setReReminderModal(null)}
        isSaving={isSavingReReminder}
      />
    )}

    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5">
          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md border border-white/15 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Leads
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  {lead.fullName}
                </h1>
                <LeadStatusBadge status={lead.status} />
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {lead.phone} • {lead.email || "No email listed"} • {lead.serviceType || lead.projectType || "General Software"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {lead.status !== "CONVERTED" ? (
                <button onClick={() => setShowConvert(true)} disabled={isAnyActionPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50">
                  <UserPlus className="h-4 w-4" />{converting ? "Converting..." : "Convert to Customer"}
                </button>
              ) : convertedId ? (
                <Link href={`/customers/${convertedId}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700">
                  <UserPlus className="h-4 w-4" />View Customer Account
                </Link>
              ) : null}

              <Link href={`/leads/${id}/edit`} 
                className={`inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 ${isAnyActionPending ? "pointer-events-none opacity-50" : ""}`}>
                <Pencil className="h-3.5 w-3.5" />Edit Entry
              </Link>

              <button onClick={handleToggleFollowUp} disabled={isAnyActionPending}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition disabled:opacity-50 ${
                  lead.followUp
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/10 text-white backdrop-blur-md border border-white/15 hover:bg-white/20"
                }`}>
                {isToggling ? "Updating..." : lead.followUp
                  ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />Followed Up</>
                  : <><Circle className="h-3.5 w-3.5 text-slate-300" />Mark Followed Up</>}
              </button>

              <button onClick={() => setShowReminderModal(true)} disabled={isAnyActionPending}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 disabled:opacity-50">
                <Clock className="h-3.5 w-3.5" />Set Reminder
              </button>

              {confirmDelete ? (
                <div className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/30 px-3 py-1.5">
                  <span className="text-xs font-bold text-rose-200">Delete?</span>
                  <button onClick={handleDelete} disabled={isAnyActionPending}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700">Yes</button>
                  <button onClick={() => setConfirmDelete(false)} disabled={isAnyActionPending}
                    className="rounded-lg border border-rose-400/40 px-2.5 py-1 text-xs font-bold text-rose-200 hover:bg-white/10">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} disabled={isAnyActionPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 px-3.5 py-2.5 text-xs font-bold text-rose-300 border border-rose-500/30 hover:bg-rose-500/30">
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </button>
              )}
            </div>
          </div>
        </div>
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

      {/* Follow-up banner */}
      {lead.followUp && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-3 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Marked as followed up in pipeline.</span>
          </div>
          <button onClick={handleToggleFollowUp} disabled={isAnyActionPending} className="underline text-emerald-700 hover:text-emerald-900">Undo Action</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Client info card */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Client & Contact Profile</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <InfoRow icon={<User className="h-4 w-4 text-blue-500" />}         label="Full Name" value={lead.fullName} />
            <InfoRow icon={<Phone className="h-4 w-4 text-emerald-500" />}      label="Phone Number" value={lead.phone} />
            <InfoRow icon={<Mail className="h-4 w-4 text-indigo-500" />}         label="Email Address" value={lead.email || "—"} />
            <InfoRow icon={<Layers className="h-4 w-4 text-purple-500" />}       label="Project / Service" value={lead.serviceType || lead.projectType || "General Software"} />
            <InfoRow icon={<MapPin className="h-4 w-4 text-amber-500" />}       label="State" value={lead.state || "—"} />
            <InfoRow icon={<MapPin className="h-4 w-4 text-amber-500" />}       label="City" value={lead.city || "—"} />
            <InfoRow icon={<CalendarDays className="h-4 w-4 text-slate-400" />} label="Entry Date" value={formatDate(lead.createdAt)} />
          </div>
        </div>

        {/* Executive Assignment Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
            Assigned Executive
          </h2>
          {lead.employee ? (
            <div className="space-y-2">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{lead.employee.name}</p>
              <p className="text-xs text-slate-500 font-semibold">{lead.employee.role} • {lead.employee.email}</p>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-400">No executive assigned yet.</p>
          )}
        </div>
      </div>

      {/* Reminder History Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Scheduled Follow-ups & Reminders</h2>
            <p className="mt-0.5 text-xs text-slate-500">{reminders.length} reminder entries recorded</p>
          </div>
        </div>

        {reminders.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-xs font-bold text-slate-500">No reminders recorded. Click "Set Reminder" above to add one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reminders.map((r) => {
              const isDone = r.status === "DONE";
              return (
                <div key={r.id} className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    isDone ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : "bg-blue-50 text-blue-600 dark:bg-blue-950/50"
                  }`}>
                    <Clock className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-extrabold ${isDone ? "text-emerald-600" : "text-blue-600"}`}>
                          {isDone ? "Completed" : "Pending"}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">• {formatDateTime(r.reminderAt)}</span>
                      </div>

                      {!isDone && (
                        <button
                          disabled={isAnyActionPending}
                          onClick={() => setReReminderModal({ id: r.id, currentDt: r.reminderAt, currentNote: r.note })}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                          <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                          Reschedule
                        </button>
                      )}
                    </div>

                    {r.note && (
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 p-3 mt-1">
                        "{r.note}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
    </>
  );
}