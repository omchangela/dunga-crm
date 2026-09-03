"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Download,
  Upload,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Trash2,
  ChevronDown,
  MapPin,
  Loader2,
  UserCheck,
  UserMinus,
  UserPlus,
  Phone,
  Mail,
  Filter,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowUpRight,
  Check,
} from "lucide-react";
import * as XLSX from "xlsx";
import { fetchLeads, leadsApi, remindersApi, employeesApi } from "@/lib/api";
import { d } from "@/lib/enum-maps";
import { ListSkeleton } from "@/components/ui/skeleton";

// ── Avatar Helpers ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-gradient-to-br from-blue-600 to-indigo-700",
  "bg-gradient-to-br from-purple-600 to-pink-700",
  "bg-gradient-to-br from-emerald-600 to-teal-700",
  "bg-gradient-to-br from-amber-600 to-orange-700",
  "bg-gradient-to-br from-rose-600 to-red-700",
  "bg-gradient-to-br from-cyan-600 to-blue-700",
  "bg-gradient-to-br from-violet-600 to-purple-700",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  if (!name) return "LD";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Status Config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  string,
  { dot: string; text: string; bg: string; border: string; label: string }
> = {
  PENDING: {
    dot: "bg-amber-400 shadow-amber-400/50",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800/40",
    label: "Pending",
  },
  FOLLOWUP: {
    dot: "bg-blue-400 shadow-blue-400/50",
    text: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800/40",
    label: "Follow Up",
  },
  CONVERTED: {
    dot: "bg-emerald-400 shadow-emerald-400/50",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800/40",
    label: "Converted",
  },
  REJECTED: {
    dot: "bg-rose-400 shadow-rose-400/50",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800/40",
    label: "Rejected",
  },
};

const INLINE_STATUS_OPTIONS = ["PENDING", "REJECTED", "CONVERTED"];
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  REJECTED: "Rejected",
  CONVERTED: "Converted",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

// ── Export Helpers ───────────────────────────────────────────────────────────

function buildExportRows(leads: any[]) {
  return leads.map((l) => ({
    "Client Name": l.fullName,
    Phone: l.phone,
    Email: l.email ?? "",
    City: l.city ?? "",
    "Project Type": l.projectType ?? "",
    Source: d.source(l.source),
    Status: STATUS_LABELS[l.status] ?? l.status,
    "Follow Up": l.followUp ? "Yes" : "No",
    "Created At": new Date(l.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  }));
}

function exportCSV(leads: any[]) {
  const rows = buildExportRows(leads);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      Object.values(r)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportXLSX(leads: any[]) {
  const rows = buildExportRows(leads);
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0]).map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String((r as any)[k]).length)) + 2,
  }));
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, `leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function toDateTimeLocal(iso: string) {
  const dt = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(
    dt.getHours()
  )}:${p(dt.getMinutes())}`;
}

// ── Reminder Modal ───────────────────────────────────────────────────────────

function ReminderModal({
  leadName,
  onSave,
  onClose,
}: {
  leadName: string;
  onSave: (iso: string, note: string) => void;
  onClose: () => void;
}) {
  const defaultVal = () => {
    const dt = new Date();
    dt.setHours(dt.getHours() + 1, 0, 0, 0);
    return toDateTimeLocal(dt.toISOString());
  };
  const [dt, setDt] = useState(defaultVal);
  const [note, setNote] = useState("");
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const handleSave = async () => {
    if (!dt || isSavingReminder) return;
    setIsSavingReminder(true);
    try {
      await onSave(new Date(dt).toISOString(), note.trim());
    } finally {
      setIsSavingReminder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Schedule Follow-Up</p>
            <p className="text-xs text-slate-500">{leadName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSavingReminder}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Reminder Date & Time
            </label>
            <input
              type="datetime-local"
              value={dt}
              onChange={(e) => setDt(e.target.value)}
              disabled={isSavingReminder}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm font-medium text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSavingReminder}
              placeholder="Add reminder details..."
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              disabled={!dt || isSavingReminder}
              onClick={handleSave}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingReminder ? "Setting..." : "Save Reminder"}
            </button>
            <button
              onClick={onClose}
              disabled={isSavingReminder}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({
  lead,
  employees,
  onClose,
  onSaved,
}: {
  lead: any;
  employees: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [empId, setEmpId] = useState(lead.employee?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAssign() {
    if (!empId || saving) return;
    setSaving(true);
    setError("");
    try {
      await employeesApi.assignLead(lead.id, empId);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to assign.");
      setSaving(false);
    }
  }

  async function handleUnassign() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await employeesApi.unassignLead(lead.id);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to unassign.");
      setSaving(false);
    }
  }

  const activeEmployees = employees.filter((e) => e.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Assign Lead</p>
            <p className="text-xs text-slate-500">
              {lead.fullName} — {lead.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Assign to Team Member
            </label>
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm font-medium text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
            >
              <option value="">Select executive</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.role})
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          <div className="flex gap-2 pt-2">
            {lead.employee && (
              <button
                onClick={handleUnassign}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
              >
                <UserMinus className="h-3.5 w-3.5" />
                Unassign
              </button>
            )}
            <button
              onClick={handleAssign}
              disabled={!empId || saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" />
              {saving ? "Assigning..." : "Assign Lead"}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<
    "idle" | "uploading" | "processing" | "completed" | "failed"
  >("idle");
  const [jobStatus, setJobStatus] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function handleClose() {
    stopPolling();
    onClose();
  }

  function handleReset() {
    setFile(null);
    setState("idle");
    setJobStatus(null);
  }

  function validateFile(f: File): string | null {
    if (!f.name.toLowerCase().endsWith(".csv")) return "Only .csv files are allowed.";
    if (f.size > 5 * 1024 * 1024) return "File too large (max 5 MB).";
    return null;
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) {
      setJobStatus({ error: err });
      return;
    }
    setJobStatus(null);
    setFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setState("uploading");
    try {
      const data = await leadsApi.bulkImport(file);
      const jobId = data?.jobId;
      if (!jobId) throw new Error(data?.message ?? "No job ID returned.");
      setState("processing");
      setJobStatus({ state: "queued", progress: 0, message: "Queued..." });
      intervalRef.current = setInterval(async () => {
        try {
          const status = await leadsApi.getImportStatus(jobId);
          setJobStatus(status);
          if (status.state === "completed") {
            stopPolling();
            setState("completed");
            onComplete();
          }
          if (status.state === "failed") {
            stopPolling();
            setState("failed");
          }
        } catch {}
      }, 2000);
    } catch (err: any) {
      setState("failed");
      setJobStatus({ error: err?.message ?? "Upload failed." });
    }
  }

  function downloadSample() {
    const csv = [
      "fullName,phone,email,state,city,serviceType,source",
      "Arjun Nair,9900112233,arjun@gmail.com,Andhra Pradesh,Vijayawada,WEB_DEVELOPMENT,ADVERTISEMENT",
      "Priya Sharma,9876543210,priya@gmail.com,Telangana,Hyderabad,APP_DEVELOPMENT,CLIENT_REFERENCE",
      "Rahul Kumar,9123456789,,Karnataka,Bangalore,APP_WEB_DEVELOPMENT,SALES_EXECUTIVE",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_sample.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const busy = state === "uploading" || state === "processing";
  const result = jobStatus?.result;
  const hasErrors = result?.errors?.length > 0;

  const headerLabel =
    state === "completed"
      ? hasErrors
        ? "Import Complete (with warnings)"
        : "Import Successful"
      : state === "failed"
      ? "Import Failed"
      : busy
      ? "Importing Records..."
      : "Import Leads from CSV";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <p className="font-bold text-slate-900 dark:text-white">{headerLabel}</p>
          {!busy && (
            <button
              onClick={handleClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-4 p-6">
          {state === "idle" && (
            <>
              {file ? (
                <div className="flex items-start justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        {file.name}
                      </p>
                      <p className="text-xs text-emerald-600">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileSelect(f);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 text-center transition hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                      e.target.value = "";
                    }}
                  />
                  <Upload className="h-8 w-8 text-slate-400" />
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Drop your CSV file here
                  </p>
                  <p className="text-xs text-slate-400">.csv only · max 5 MB</p>
                </div>
              )}

              {jobStatus?.error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                  {jobStatus.error}
                </p>
              )}

              <div className="space-y-1.5 pt-1">
                <button
                  onClick={downloadSample}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> Download Sample Template
                </button>
                <p className="text-xs text-slate-400">
                  Headers required: <span className="font-mono text-slate-600 dark:text-slate-300">fullName, phone, serviceType, source</span>
                </p>
              </div>
            </>
          )}

          {busy && (
            <div className="space-y-3 py-4">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{file?.name}</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{jobStatus?.message || "Uploading file..."}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {jobStatus?.progress || 0}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                    style={{
                      width: `${Math.max(
                        jobStatus?.progress || 0,
                        state === "uploading" ? 5 : 0
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {state === "completed" && result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <span>Imported</span>
                <span>{result.imported ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 dark:bg-amber-950/40 text-xs font-bold text-amber-700 dark:text-amber-300">
                <span>Skipped (Duplicates)</span>
                <span>{result.skipped ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-2.5 dark:bg-rose-950/40 text-xs font-bold text-rose-700 dark:text-rose-300">
                <span>Failed</span>
                <span>{result.failed ?? 0}</span>
              </div>
            </div>
          )}

          {state === "failed" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-600">
              {jobStatus?.error || "Import failed. Please verify the CSV format."}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
          {state === "idle" && (
            <>
              <button
                onClick={handleClose}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Upload & Import
              </button>
            </>
          )}
          {(state === "completed" || state === "failed") && (
            <button
              onClick={handleClose}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function LeadsPage() {
  const router = useRouter();

  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "followup" | "nofollowup">("all");

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [assignModal, setAssignModal] = useState<any | null>(null);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [assignFilter, setAssignFilter] = useState<"all" | "assigned" | "unassigned">("all");

  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [reminderModal, setReminderModal] = useState<{ leadId: string; leadName: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingConvertId, setPendingConvertId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState<10 | 25 | 50>(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action status indicators
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [followUpTogglingId, setFollowUpTogglingId] = useState<string | null>(null);

  const isAnyActionProcessing =
    isBulkUpdating || !!statusChangingId || converting || !!isDeletingId || !!followUpTogglingId;

  async function load() {
    setIsLoading(true);
    try {
      const { leads } = await fetchLeads({ status: "ALL", limit: "50000" });
      setLeads(leads);
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message ?? "Failed to load leads." });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    employeesApi
      .getAll()
      .then((d) => setAllEmployees(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // ── Derived Data ───────────────────────────────────────────────────────────

  const allLeads = leads.filter((l) => l.status !== "CONVERTED");

  const cityOptions = Array.from(
    new Set(allLeads.map((l) => (l.city ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filtered = allLeads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      l.fullName.toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").includes(q) ||
      (l.city ?? "").toLowerCase().includes(q) ||
      (l.projectType ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || l.status === statusFilter;
    const matchCity = !cityFilter || l.city === cityFilter;
    const matchAssign =
      assignFilter === "all"
        ? true
        : assignFilter === "assigned"
        ? !!l.employee
        : !l.employee;
    return matchSearch && matchStatus && matchCity && matchAssign;
  });

  const tabFiltered = filtered.filter((l) => {
    if (activeTab === "followup") return !!l.followUp;
    if (activeTab === "nofollowup") return !l.followUp;
    return true;
  });

  const localTabCounts = {
    all: filtered.length,
    followup: filtered.filter((l) => l.followUp).length,
    nofollowup: filtered.filter((l) => !l.followUp).length,
  };

  const totalLeads = allLeads.length;
  const totalPages = Math.max(1, Math.ceil(tabFiltered.length / rowsPerPage));
  const paginated = tabFiltered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const showingFrom = tabFiltered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingTo = Math.min(currentPage * rowsPerPage, tabFiltered.length);

  const allPageSelected = paginated.length > 0 && paginated.every((l) => selectedIds.has(l.id));
  const somePageSelected = paginated.some((l) => selectedIds.has(l.id));
  const allFilteredSelected =
    tabFiltered.length > 0 && tabFiltered.every((l) => selectedIds.has(l.id));
  const hasActiveFilters = !!statusFilter || !!cityFilter || assignFilter !== "all";

  // ── Action Handlers ──────────────────────────────────────────────────────

  function toggleSelectAll() {
    if (isAnyActionProcessing) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) paginated.forEach((l) => next.delete(l.id));
      else paginated.forEach((l) => next.add(l.id));
      return next;
    });
  }

  function toggleSelect(id: string) {
    if (isAnyActionProcessing) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    if (isAnyActionProcessing) return;
    setSelectedIds(new Set(tabFiltered.map((l) => l.id)));
  }

  function clearSelection() {
    if (isAnyActionProcessing) return;
    setSelectedIds(new Set());
  }

  function flash(type: "success" | "error", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleStatusChange(leadId: string, status: string) {
    if (isAnyActionProcessing) return;
    if (status === "CONVERTED") {
      setPendingConvertId(leadId);
      return;
    }

    setStatusChangingId(leadId);
    try {
      await leadsApi.updateStatus(leadId, status);
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to update status.");
    } finally {
      setStatusChangingId(null);
    }
  }

  async function handleConfirmConvert() {
    if (!pendingConvertId || converting) return;
    setConverting(true);
    try {
      const res = await leadsApi.convertToCustomer(pendingConvertId);
      setPendingConvertId(null);
      router.push(`/customers/${res.data.id}`);
    } catch (err: any) {
      setPendingConvertId(null);
      flash("error", err?.message ?? "Conversion failed.");
      setConverting(false);
    }
  }

  async function handleToggleFollowUp(leadId: string) {
    if (isAnyActionProcessing) return;
    setFollowUpTogglingId(leadId);
    try {
      await leadsApi.toggleFollowUp(leadId);
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to toggle follow-up.");
    } finally {
      setFollowUpTogglingId(null);
    }
  }

  async function bulkMarkFollowUp() {
    if (isAnyActionProcessing || selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      await leadsApi.bulkFollowUp(Array.from(selectedIds), true);
      clearSelection();
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Bulk update failed.");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  async function bulkMarkUnFollowUp() {
    if (isAnyActionProcessing || selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      await leadsApi.bulkFollowUp(Array.from(selectedIds), false);
      clearSelection();
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Bulk update failed.");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  async function handleSaveReminder(leadId: string, iso: string, note: string) {
    await remindersApi.create(leadId, { reminderAt: iso, note: note || "Follow up" });
    setReminderModal(null);
    flash("success", "Reminder set successfully.");
  }

  async function handleDeleteLead(id: string) {
    if (isAnyActionProcessing) return;
    setIsDeletingId(id);
    try {
      await leadsApi.delete(id);
      setConfirmDeleteId(null);
      setOpenActionId(null);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to delete lead.");
    } finally {
      setIsDeletingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Convert to Customer Modal */}
      {pendingConvertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <p className="font-bold text-slate-900 dark:text-white">Convert Lead to Customer</p>
              <button
                onClick={() => setPendingConvertId(null)}
                disabled={converting}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Are you sure you want to convert this lead into an active customer account?
              </p>
              <p className="mt-1 text-xs text-slate-400">
                This will move the lead to your active clients database.
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={handleConfirmConvert}
                  disabled={converting}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  {converting ? "Converting..." : "Confirm Conversion"}
                </button>
                <button
                  onClick={() => setPendingConvertId(null)}
                  disabled={converting}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {reminderModal && (
        <ReminderModal
          leadName={reminderModal.leadName}
          onSave={(iso, note) => handleSaveReminder(reminderModal.leadId, iso, note)}
          onClose={() => setReminderModal(null)}
        />
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <ImportModal
          onClose={() => setImportModalOpen(false)}
          onComplete={() => {
            load();
            flash("success", "Leads imported successfully.");
          }}
        />
      )}

      {/* Assign Modal */}
      {assignModal && (
        <AssignModal
          lead={assignModal}
          employees={allEmployees}
          onClose={() => setAssignModal(null)}
          onSaved={() => {
            load();
            flash("success", assignModal.employee ? "Lead reassigned." : "Lead assigned.");
          }}
        />
      )}

      <div className="space-y-6 pb-12">

        {/* ══ HEADER BANNER ══ */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
                <UserPlus className="h-3.5 w-3.5 text-blue-300" />
                Leads Management
                <span className="opacity-40">•</span>
                {totalLeads} Total Records
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                Leads Database
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Manage prospective client inquiries, follow-up scheduling, and customer conversions.
              </p>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => !isAnyActionProcessing && setImportModalOpen(true)}
                disabled={isAnyActionProcessing}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Import CSV
              </button>

              <div className="relative">
                <button
                  onClick={() => !isAnyActionProcessing && setShowExportMenu((p) => !p)}
                  disabled={isAnyActionProcessing}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
                </button>

                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 shadow-xl">
                      <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {tabFiltered.length} Filtered Leads
                      </p>
                      <button
                        onClick={() => {
                          exportCSV(tabFiltered);
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-blue-500" /> Export as CSV
                      </button>
                      <button
                        onClick={() => {
                          exportXLSX(tabFiltered);
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export as Excel
                      </button>
                    </div>
                  </>
                )}
              </div>

              <Link
                href={isAnyActionProcessing ? "#" : "/leads/new"}
                className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-95 ${
                  isAnyActionProcessing ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <Plus className="h-4 w-4" />
                Add New Lead
              </Link>
            </div>
          </div>
        </section>

        {/* ══ TOP METRIC KPI CARDS ══ */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Active Inquiries",
              value: totalLeads,
              sub: "Total Unconverted Leads",
              icon: UserPlus,
              color: "from-blue-600 to-indigo-600",
            },
            {
              label: "Follow-up Required",
              value: localTabCounts.followup,
              sub: `${localTabCounts.followup} Leads Scheduled`,
              icon: Bell,
              color: "from-amber-600 to-orange-600",
            },
            {
              label: "Assigned Execs",
              value: leads.filter((l) => l.employee).length,
              sub: "Assigned to Sales Team",
              icon: UserCheck,
              color: "from-purple-600 to-violet-600",
            },
            {
              label: "Converted Clients",
              value: leads.filter((l) => l.status === "CONVERTED").length,
              sub: "Successfully Converted",
              icon: CheckCircle2,
              color: "from-emerald-600 to-teal-600",
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

        {/* Banner Alert Messages */}
        {msg && (
          <div
            className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 text-xs font-bold ${
              msg.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                : "border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
            }`}
          >
            {msg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-auto">
              <X className="h-4 w-4 opacity-60 hover:opacity-100" />
            </button>
          </div>
        )}

        {/* ══ LEADS DATA TABLE CONTAINER ══ */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          {/* Table Control Bar */}
          <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
              {(["all", "followup", "nofollowup"] as const).map((tab) => {
                const labels = {
                  all: "All Leads",
                  followup: "Follow-up Required",
                  nofollowup: "No Follow-up",
                } as const;
                const counts = {
                  all: localTabCounts.all,
                  followup: localTabCounts.followup,
                  nofollowup: localTabCounts.nofollowup,
                };
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    disabled={isAnyActionProcessing}
                    onClick={() => {
                      setActiveTab(tab);
                      setCurrentPage(1);
                    }}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
                      isActive
                        ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {labels[tab]}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-none ${
                        isActive
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"
                          : "bg-slate-200/70 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {counts[tab]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search & Filter Triggers */}
            <div className="flex items-center gap-2">
              {/* Search Bar */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search leads by name, phone, city..."
                  value={search}
                  disabled={isAnyActionProcessing}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 w-64 rounded-xl border border-slate-200/80 bg-slate-50 pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white dark:border-slate-800 dark:bg-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none disabled:opacity-50"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filters Dropdown Menu */}
              <div className="relative">
                <button
                  onClick={() => !isAnyActionProcessing && setShowFilters((p) => !p)}
                  disabled={isAnyActionProcessing}
                  className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
                    hasActiveFilters
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/50"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                  )}
                </button>

                {showFilters && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowFilters(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-52 space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Lead Status
                        </label>
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                        >
                          <option value="">All Statuses</option>
                          {["PENDING", "REJECTED"].map((v) => (
                            <option key={v} value={v}>
                              {STATUS_LABELS[v]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Filter City
                        </label>
                        <select
                          value={cityFilter}
                          onChange={(e) => {
                            setCityFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                        >
                          <option value="">All Cities</option>
                          {cityOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Assignment Status
                        </label>
                        <select
                          value={assignFilter}
                          onChange={(e) => {
                            setAssignFilter(e.target.value as any);
                            setCurrentPage(1);
                          }}
                          className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                        >
                          <option value="all">All</option>
                          <option value="assigned">Assigned</option>
                          <option value="unassigned">Unassigned</option>
                        </select>
                      </div>

                      {hasActiveFilters && (
                        <button
                          onClick={() => {
                            setStatusFilter("");
                            setCityFilter("");
                            setAssignFilter("all");
                            setCurrentPage(1);
                          }}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between border-b border-blue-100 bg-blue-50/70 px-6 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} selected
                </span>
                {!allFilteredSelected && (
                  <button
                    onClick={selectAllFiltered}
                    disabled={isAnyActionProcessing}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Select all {tabFiltered.length}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={bulkMarkFollowUp}
                  disabled={isAnyActionProcessing}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {isBulkUpdating ? "Updating..." : "Mark Follow Up"}
                </button>

                <button
                  onClick={bulkMarkUnFollowUp}
                  disabled={isAnyActionProcessing}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50"
                >
                  {isBulkUpdating ? "Updating..." : "Unmark Follow Up"}
                </button>

                <button
                  onClick={clearSelection}
                  disabled={isAnyActionProcessing}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-white dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ══ LEADS DATA TABLE ══ */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <ListSkeleton rows={6} />
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold">
                    <th className="w-10 px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        disabled={isAnyActionProcessing}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected && !allPageSelected;
                        }}
                        onChange={toggleSelectAll}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600 disabled:opacity-50"
                      />
                    </th>
                    <th className="py-3.5 px-3">#</th>
                    <th className="py-3.5 px-4">Lead Name</th>
                    <th className="py-3.5 px-4">Source</th>
                    <th className="py-3.5 px-4">City</th>
                    <th className="py-3.5 px-4">Project Type</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Assigned To</th>
                    <th className="py-3.5 px-4">Follow-Up</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center">
                          <UserPlus className="mb-2 h-8 w-8 text-slate-300" />
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            No lead records match your search or filter criteria.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((lead, idx) => {
                      const cfg = STATUS_CFG[lead.status] ?? STATUS_CFG["PENDING"];
                      const isOpen = openActionId === lead.id;
                      const rowNum = String(
                        (currentPage - 1) * rowsPerPage + idx + 1
                      ).padStart(2, "0");
                      const isSelected = selectedIds.has(lead.id);

                      return (
                        <tr
                          key={lead.id}
                          onClick={(e) => {
                            if (
                              isAnyActionProcessing ||
                              (e.target as HTMLElement).closest(
                                "button, a, select, input"
                              )
                            )
                              return;
                            router.push(`/leads/${lead.id}`);
                          }}
                          className={`transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                            isAnyActionProcessing ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                          } ${isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}
                        >
                          {/* Checkbox */}
                          <td className="w-10 px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(lead.id)}
                              disabled={isAnyActionProcessing}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600 disabled:opacity-50"
                            />
                          </td>

                          {/* Row # */}
                          <td className="px-3 py-3.5 font-bold text-blue-600">{rowNum}</td>

                          {/* Name & Phone */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarColor(
                                  lead.fullName
                                )}`}
                              >
                                {initials(lead.fullName)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                                  {lead.fullName}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium">
                                  {lead.phone || lead.email || "No contact"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Source */}
                          <td className="px-4 py-3.5">
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {d.source(lead.source) || "Other"}
                            </span>
                          </td>

                          {/* City */}
                          <td className="px-4 py-3.5">
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                              {lead.city && <MapPin className="h-3 w-3 text-slate-400" />}
                              {lead.city || "—"}
                            </span>
                          </td>

                          {/* Project Type */}
                          <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                            {lead.serviceType || lead.projectType || "General Software"}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                              <select
                                value={lead.status}
                                disabled={isAnyActionProcessing}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(lead.id, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className={`h-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-xs font-bold focus:border-blue-600 focus:outline-none ${cfg.text}`}
                              >
                                {INLINE_STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Assigned To */}
                          <td className="px-4 py-3.5">
                            {lead.employee ? (
                              <div className="flex items-center gap-1.5">
                                <span className="max-w-[100px] truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                                  {lead.employee.name}
                                </span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await employeesApi.unassignLead(lead.id);
                                      load();
                                      flash("success", "Lead unassigned.");
                                    } catch {
                                      flash("error", "Failed to unassign.");
                                    }
                                  }}
                                  disabled={isAnyActionProcessing}
                                  className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-100"
                                >
                                  Unassign
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignModal(lead);
                                }}
                                disabled={isAnyActionProcessing}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-blue-600 hover:border-blue-200"
                              >
                                <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                                Assign
                              </button>
                            )}
                          </td>

                          {/* Follow-up & Reminder */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFollowUp(lead.id);
                                }}
                                disabled={isAnyActionProcessing}
                                className={`rounded-xl px-2.5 py-1 text-xs font-bold border ${
                                  lead.followUp
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                }`}
                              >
                                {lead.followUp ? "Follow-Up Active" : "No Follow-Up"}
                              </button>

                              <button
                                disabled={isAnyActionProcessing}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReminderModal({
                                    leadId: lead.id,
                                    leadName: lead.fullName,
                                  });
                                }}
                                title="Set reminder"
                                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                              >
                                <Bell className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Actions Dropdown */}
                          <td className="relative px-4 py-3.5 text-right">
                            <button
                              disabled={isAnyActionProcessing}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionId(isOpen ? null : lead.id);
                              }}
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>

                            {isOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => {
                                    setOpenActionId(null);
                                    setConfirmDeleteId(null);
                                  }}
                                />
                                <div className="absolute right-8 top-10 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 shadow-xl">
                                  <Link
                                    href={`/leads/${lead.id}`}
                                    onClick={() => setOpenActionId(null)}
                                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-slate-400" /> Inspect Lead
                                  </Link>

                                  {confirmDeleteId === lead.id ? (
                                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2">
                                      <p className="mb-2 text-xs font-bold text-slate-500">
                                        Delete lead?
                                      </p>
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteLead(lead.id);
                                          }}
                                          className="flex-1 rounded-lg bg-rose-600 py-1 text-xs font-bold text-white hover:bg-rose-700"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(null);
                                          }}
                                          className="flex-1 rounded-lg border border-slate-200 py-1 text-xs font-bold text-slate-500"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(lead.id);
                                      }}
                                      className="flex w-full items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Delete Lead
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between text-xs font-semibold text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-900 dark:text-white">{showingFrom}</span> to{" "}
              <span className="font-bold text-slate-900 dark:text-white">{showingTo}</span> of{" "}
              <span className="font-bold text-slate-900 dark:text-white">{tabFiltered.length}</span> leads
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value) as any);
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-xs font-bold focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1 || isAnyActionProcessing}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="px-2 font-bold text-slate-900 dark:text-white">
                  {currentPage} / {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages || isAnyActionProcessing}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </>
  );
}