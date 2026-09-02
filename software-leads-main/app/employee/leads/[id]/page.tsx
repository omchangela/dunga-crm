"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, CalendarDays,
  User, CheckCircle2, Circle, Clock, Trash2, X, UserPlus, MapPin,
} from "lucide-react";
import { Button }          from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader }      from "@/components/layout/page-header";
import { formatDate }      from "@/lib/utils";
import { employeePortalApi } from "@/lib/api";
import { Badge }           from "@/components/ui/badge";

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
    <div>
      <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function toDateTimeLocal(iso: string) {
  const dt = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

function ReminderModal({
  leadName, onSave, onClose, isSaving, title, initialDt, initialNote,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
          <div>
            <p className="font-semibold text-[#1a2035]">{title || "Set Reminder"}</p>
            <p className="text-xs text-[#8094ae]">{leadName}</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa] disabled:opacity-40">
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
              {isSaving ? "Saving..." : (title || "Add Reminder")}
            </button>
            <button onClick={onClose} disabled={isSaving}
              className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa] disabled:opacity-40">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeLeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lead, setLead]         = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showConvert, setShowConvert]     = useState(false);

  const [converting, setConverting]               = useState(false);
  const [isToggling, setIsToggling]               = useState(false);
  const [isDeleting, setIsDeleting]               = useState(false);
  const [isSavingReminder, setIsSavingReminder]   = useState(false);
  const [isSavingReReminder, setIsSavingReReminder] = useState(false);

  const [convertedId, setConvertedId]             = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reReminderModal, setReReminderModal]     = useState<{ id: string; currentDt: string; currentNote: string } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isAnyActionPending = converting || isToggling || isDeleting || isSavingReminder || isSavingReReminder;

  async function load() {
    try {
      const data = await employeePortalApi.getLeadDetail(id);
      if (!data) { setLead(null); return; }
      setLead(data);
      setReminders(Array.isArray(data.reminders) ? data.reminders : []);
    } catch {
      setLead(null);
    }
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
      await employeePortalApi.toggleFollowUp(id);
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to toggle follow-up.");
    } finally { setIsToggling(false); }
  }

  async function handleDelete() {
    if (isAnyActionPending) return;
    setIsDeleting(true);
    try {
      await employeePortalApi.deleteLead(id);
      router.push("/employee/leads");
    } catch (err: any) {
      const msg = err?.message ?? "";
      flash("error", msg.toLowerCase().includes("converted")
        ? "Cannot delete a converted lead."
        : msg || "Failed to delete lead.");
      setIsDeleting(false);
    }
  }

  async function handleConvert() {
    if (isAnyActionPending) return;
    setConverting(true);
    try {
      const res = await employeePortalApi.convertLead(id);
      if (!res.success) throw new Error(res.message);
      const customerId = res.data?.id ?? res.data?.customerId;
      setConvertedId(customerId ?? null);
      setShowConvert(false);
      flash("success", "Lead converted to customer successfully.", 5000);
      await load();
    } catch (err: any) {
      setShowConvert(false);
      flash("error", err?.message ?? "Conversion failed.", 5000);
    } finally { setConverting(false); }
  }

  async function handleSaveReminder(iso: string, note: string) {
    if (isAnyActionPending) return;
    setIsSavingReminder(true);
    try {
      await employeePortalApi.createReminder(id, { reminderAt: iso, note: note || "Follow up" });
      setShowReminderModal(false);
      await load();
      flash("success", "Reminder set.");
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to set reminder.");
    } finally { setIsSavingReminder(false); }
  }

  async function handleSaveReReminder(iso: string, note: string) {
    if (!reReminderModal || isAnyActionPending) return;
    setIsSavingReReminder(true);
    try {
      await employeePortalApi.createReReminder(reReminderModal.id, { reminderAt: iso, note });
      setReReminderModal(null);
      await load();
      flash("success", "Re-reminder created successfully.");
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to create re-reminder.");
    } finally { setIsSavingReReminder(false); }
  }

  if (!lead) return (
    <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">
      Lead not found or not assigned to you.
    </div>
  );

  return (
    <>
      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
              <p className="font-semibold text-[#1a2035]">Convert to Customer</p>
              <button onClick={() => setShowConvert(false)} disabled={converting}
                className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa] disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">Are you sure you want to convert this lead to a customer?</p>
              <p className="mt-1 text-xs text-[#8094ae]">This action cannot be undone.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={handleConvert} disabled={converting}
                  className="flex-1 rounded-lg bg-[#0971fe] py-2 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
                  {converting ? "Converting…" : "Yes, Convert"}
                </button>
                <button onClick={() => setShowConvert(false)} disabled={converting}
                  className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa] disabled:opacity-40">
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

      <div className="space-y-6">

        {/* Toast */}
        {toast && (
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}>
            {toast.type === "success"
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <X className="h-4 w-4 shrink-0" />}
            {toast.text}
            <button onClick={() => setToast(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" disabled={isAnyActionPending}>
              <Link href="/employee/leads" className={isAnyActionPending ? "pointer-events-none opacity-50" : ""}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <PageHeader title={lead.fullName} subtitle="Client lead details and status." />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lead.status !== "CONVERTED" ? (
              <button onClick={() => setShowConvert(true)} disabled={isAnyActionPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#0971fe] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0558d4] disabled:opacity-50">
                <UserPlus className="h-4 w-4" />{converting ? "Converting..." : "Convert to Customer"}
              </button>
            ) : convertedId ? (
              <Link href={`/employee/customers/${convertedId}`}
                className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
                <UserPlus className="h-4 w-4" />View Customer
              </Link>
            ) : null}
            <button onClick={handleToggleFollowUp} disabled={isAnyActionPending}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                lead.followUp
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-[#e5e9f2] bg-white text-[#8094ae] hover:bg-[#f5f6fa] hover:text-[#1a2035]"
              }`}>
              {isToggling ? "Updating..." : lead.followUp
                ? <><CheckCircle2 className="h-4 w-4 text-green-600" />Followed Up</>
                : <><Circle className="h-4 w-4" />Mark as Followed Up</>}
            </button>
            <button onClick={() => setShowReminderModal(true)} disabled={isAnyActionPending}
              className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-2 text-sm font-medium text-[#8094ae] shadow-sm hover:bg-[#f5f6fa] hover:text-[#1a2035] disabled:opacity-50">
              <Clock className="h-4 w-4" />Set Reminder
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <span className="text-xs text-red-600">{isDeleting ? "Deleting..." : "Delete this lead?"}</span>
                <button onClick={handleDelete} disabled={isAnyActionPending}
                  className="rounded bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">
                  Yes
                </button>
                <button onClick={() => setConfirmDelete(false)} disabled={isAnyActionPending}
                  className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-500 hover:bg-red-100 disabled:opacity-50">
                  No
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} disabled={isAnyActionPending}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-2 text-sm font-medium text-red-500 shadow-sm hover:border-red-200 hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />Delete
              </button>
            )}
          </div>
        </div>

        {/* Follow-up banner */}
        {lead.followUp && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <p className="text-sm text-green-700">
              Marked as followed up.{" "}
              <button onClick={handleToggleFollowUp} disabled={isAnyActionPending}
                className="underline text-green-600 hover:text-green-800 disabled:opacity-50">
                Undo
              </button>
            </p>
          </div>
        )}

        {/* Client Information */}
        <Card>
          <CardHeader><CardTitle className="text-base">Client Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<User className="h-4 w-4" />}         label="Client Name" value={lead.fullName} />
              <InfoRow icon={<Phone className="h-4 w-4" />}        label="Phone"       value={lead.phone} />
              <InfoRow icon={<Mail className="h-4 w-4" />}         label="Email"       value={lead.email || "—"} />
              <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Created"     value={formatDate(lead.createdAt)} />
              <InfoRow icon={<MapPin className="h-4 w-4" />}       label="State"       value={lead.state || "—"} />
              <InfoRow icon={<MapPin className="h-4 w-4" />}       label="City"        value={lead.city  || "—"} />
            </div>
          </CardContent>
        </Card>

        {/* Reminder History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reminder History</CardTitle>
            <p className="text-xs text-muted-foreground">
              {reminders.length} reminder{reminders.length !== 1 ? "s" : ""} recorded
            </p>
          </CardHeader>
          <CardContent>
            {reminders.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="mx-auto mb-3 h-9 w-9 text-[#8094ae]" />
                <p className="text-sm text-[#8094ae]">No reminders yet. Use the "Set Reminder" button above.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {reminders.map((r, idx) => {
                  const isDone = r.status === "DONE";
                  return (
                    <div key={r.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                          isDone
                            ? "border-green-400 bg-green-50"
                            : "border-[#0971fe] bg-blue-50"
                        }`}>
                          {isDone
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            : <Clock className="h-3.5 w-3.5 text-[#0971fe]" />}
                        </div>
                        {idx < reminders.length - 1 && (
                          <div className="mt-1 w-px flex-1 bg-[#e5e9f2]" style={{ minHeight: 24 }} />
                        )}
                      </div>
                      <div className="mb-5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-semibold ${isDone ? "text-green-600" : "text-[#0971fe]"}`}>
                              {isDone ? "Done" : "Pending"}
                            </span>
                            <span className="text-xs text-[#8094ae]">{formatDateTime(r.reminderAt)}</span>
                            <Badge variant={r.isReReminder ? "review" : "outline"}>
                              {r.isReReminder ? "Re-Reminder" : "Reminder"}
                            </Badge>
                          </div>
                          {!isDone && (
                            <button
                              disabled={isAnyActionPending}
                              onClick={() => setReReminderModal({ id: r.id, currentDt: r.reminderAt, currentNote: r.note })}
                              className="inline-flex items-center gap-1 rounded-md border border-[#e5e9f2] bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-[#f5f6fa] hover:text-[#0971fe] disabled:opacity-50">
                              <CalendarDays className="h-3 w-3" />Re-Reminder
                            </button>
                          )}
                        </div>
                        <div className="mt-2 space-y-1 font-mono text-xs text-[#526484] bg-gray-50 rounded-lg p-2.5">
                          {r.isReReminder && r.parentReminder ? (
                            <>
                              <div className="flex items-start">
                                <span className="text-[#8094ae] mr-1.5 shrink-0">├─</span>
                                <p className="text-xs text-gray-500">
                                  <span className="font-semibold text-gray-600">Based on:</span>{" "}
                                  {r.parentReminder.note || "No note"} ({formatDateTime(r.parentReminder.reminderAt)})
                                </p>
                              </div>
                              <div className="flex items-start">
                                <span className="text-[#8094ae] mr-1.5 shrink-0">└─</span>
                                <p className="text-sm font-sans text-[#1a2035]">{r.note || "No note"}</p>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-start">
                              <span className="text-[#8094ae] mr-1.5 shrink-0">├─</span>
                              <p className="text-sm font-sans text-[#1a2035]">{r.note || "No note"}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </>
  );
}
