"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Download, Search, SlidersHorizontal,
  MoreHorizontal, Eye, ChevronLeft, ChevronRight,
  FileSpreadsheet, X, CheckCircle2, AlertTriangle, Bell, Trash2, ChevronDown, MapPin,
  UserCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import { employeePortalApi } from "@/lib/api";
import { d } from "@/lib/enum-maps";
import { ListSkeleton } from "@/components/ui/skeleton";

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-blue-500","bg-purple-500","bg-emerald-500","bg-orange-500",
  "bg-pink-500","bg-teal-500","bg-indigo-500","bg-rose-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { dot: string; text: string }> = {
  PENDING:   { dot: "bg-yellow-400", text: "text-yellow-600" },
  REJECTED:  { dot: "bg-red-400",    text: "text-red-500"    },
  CONVERTED: { dot: "bg-purple-400", text: "text-purple-600" },
};
const INLINE_STATUS_OPTIONS = ["PENDING", "REJECTED", "CONVERTED"];
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending", REJECTED: "Rejected", CONVERTED: "Converted",
};
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

// ── Export ─────────────────────────────────────────────────────────────────────
function buildExportRows(leads: any[]) {
  return leads.map((l) => ({
    "Client Name":  l.fullName,
    "Phone":        l.phone,
    "Email":        l.email ?? "",
    "City":         l.city ?? "",
    "Project Type": l.projectType ?? d.service(l.serviceType ?? "") ?? "",
    "Source":       d.source(l.source),
    "Status":       STATUS_LABELS[l.status] ?? l.status,
    "Follow Up":    l.followUp ? "Yes" : "No",
    "Created At":   new Date(l.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
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
      Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `my_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
  XLSX.utils.book_append_sheet(wb, ws, "My Leads");
  XLSX.writeFile(wb, `my_leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Reminder modal ──────────────────────────────────────────────────────────────
function toDateTimeLocal(iso: string) {
  const dt = new Date(iso);
  const p  = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

function ReminderModal({ leadName, onSave, onClose }: {
  leadName: string; onSave: (iso: string, note: string) => void; onClose: () => void;
}) {
  const defaultVal = () => {
    const dt = new Date(); dt.setHours(dt.getHours() + 1, 0, 0, 0);
    return toDateTimeLocal(dt.toISOString());
  };
  const [dt, setDt]     = useState(defaultVal);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!dt || saving) return;
    setSaving(true);
    try { onSave(new Date(dt).toISOString(), note.trim()); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
          <div>
            <p className="font-semibold text-[#1a2035]">Set Reminder</p>
            <p className="text-xs text-[#8094ae]">{leadName}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa] disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Reminder Date &amp; Time</label>
            <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} disabled={saving}
              className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none disabled:bg-gray-50" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Note <span className="font-normal text-[#8094ae]">(optional)</span>
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={saving}
              placeholder="Add a note for this reminder…" rows={3}
              className="w-full resize-none rounded-lg border border-[#e5e9f2] px-3 py-2 text-sm text-gray-700 placeholder:text-[#b0bac9] focus:border-[#0971fe] focus:outline-none disabled:bg-gray-50" />
          </div>
          <div className="flex gap-2">
            <button disabled={!dt || saving} onClick={handleSave}
              className="flex-1 rounded-lg bg-[#0971fe] py-2 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
              {saving ? "Setting…" : "Add Reminder"}
            </button>
            <button onClick={onClose} disabled={saving}
              className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa] disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────
export default function EmployeeLeadsPage() {
  const router = useRouter();

  const [leads, setLeads]               = useState<any[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter]     = useState("");
  const [activeTab, setActiveTab]       = useState<"all" | "followup" | "nofollowup">("all");
  const [showSearch, setShowSearch]     = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);
  const [rowsPerPage, setRowsPerPage]   = useState<10 | 25 | 50>(10);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  const [openActionId, setOpenActionId]         = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId]   = useState<string | null>(null);
  const [reminderModal, setReminderModal]       = useState<{ leadId: string; leadName: string } | null>(null);
  const [pendingConvertId, setPendingConvertId] = useState<string | null>(null);
  const [converting, setConverting]             = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isBulkUpdating, setIsBulkUpdating]           = useState(false);
  const [statusChangingId, setStatusChangingId]         = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId]                 = useState<string | null>(null);
  const [followUpTogglingId, setFollowUpTogglingId]     = useState<string | null>(null);

  const isAnyActionProcessing = isBulkUpdating || !!statusChangingId || converting || !!isDeletingId || !!followUpTogglingId;

  async function load() {
    setIsLoading(true);
    try {
      const data = await employeePortalApi.leads();
      setLeads(Array.isArray(data?.leads) ? data.leads : Array.isArray(data) ? data : []);
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message ?? "Failed to load leads." });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function flash(type: "success" | "error", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const cityOptions = Array.from(
    new Set(leads.map((l) => (l.city ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      l.fullName?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.city ?? "").toLowerCase().includes(q) ||
      (l.projectType ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || l.status === statusFilter;
    const matchCity   = !cityFilter   || l.city === cityFilter;
    return matchSearch && matchStatus && matchCity;
  });

  const tabFiltered = filtered.filter((l) => {
    if (activeTab === "followup")   return !!l.followUp;
    if (activeTab === "nofollowup") return !l.followUp;
    return true;
  });

  const tabCounts = {
    all:        filtered.length,
    followup:   filtered.filter((l) => l.followUp).length,
    nofollowup: filtered.filter((l) => !l.followUp).length,
  };

  const totalPages  = Math.max(1, Math.ceil(tabFiltered.length / rowsPerPage));
  const paginated   = tabFiltered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const showingFrom = tabFiltered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingTo   = Math.min(currentPage * rowsPerPage, tabFiltered.length);
  const hasFilters  = !!statusFilter || !!cityFilter;

  const allPageSelected     = paginated.length > 0 && paginated.every((l) => selectedIds.has(l.id));
  const somePageSelected    = paginated.some((l) => selectedIds.has(l.id));
  const allFilteredSelected = tabFiltered.length > 0 && tabFiltered.every((l) => selectedIds.has(l.id));

  // ── Handlers ─────────────────────────────────────────────────────────────────
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
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAllFiltered() {
    if (isAnyActionProcessing) return;
    setSelectedIds(new Set(tabFiltered.map((l) => l.id)));
  }
  function clearSelection() {
    if (isAnyActionProcessing) return;
    setSelectedIds(new Set());
  }

  async function handleStatusChange(leadId: string, status: string) {
    if (isAnyActionProcessing) return;
    if (status === "CONVERTED") { setPendingConvertId(leadId); return; }
    setStatusChangingId(leadId);
    try {
      const res = await employeePortalApi.updateLeadStatus(leadId, status);
      if (!res.success) throw new Error(res.message);
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to update status.");
    } finally { setStatusChangingId(null); }
  }

  async function handleConfirmConvert() {
    if (!pendingConvertId || converting) return;
    setConverting(true);
    try {
      const res = await employeePortalApi.convertLead(pendingConvertId);
      if (!res.success) throw new Error(res.message);
      const customerId = res.data?.id ?? res.data?.customerId;
      setPendingConvertId(null);
      if (customerId) router.push(`/employee/customers/${customerId}`);
      else { await load(); flash("success", "Lead converted to customer."); }
    } catch (err: any) {
      setPendingConvertId(null);
      flash("error", err?.message ?? "Conversion failed.");
    } finally { setConverting(false); }
  }

  async function handleToggleFollowUp(leadId: string) {
    if (isAnyActionProcessing) return;
    setFollowUpTogglingId(leadId);
    try {
      const res = await employeePortalApi.toggleFollowUp(leadId);
      if (!res.success) throw new Error(res.message);
      await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Failed to toggle follow-up.");
    } finally { setFollowUpTogglingId(null); }
  }

  async function bulkMarkFollowUp() {
    if (isAnyActionProcessing || selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => employeePortalApi.toggleFollowUp(id)));
      clearSelection(); await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Bulk update failed.");
    } finally { setIsBulkUpdating(false); }
  }

  async function bulkMarkUnFollowUp() {
    if (isAnyActionProcessing || selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => employeePortalApi.toggleFollowUp(id)));
      clearSelection(); await load();
    } catch (err: any) {
      flash("error", err?.message ?? "Bulk update failed.");
    } finally { setIsBulkUpdating(false); }
  }

  async function handleSaveReminder(leadId: string, iso: string, note: string) {
    const res = await employeePortalApi.createReminder(leadId, { reminderAt: iso, note: note || "Follow up" });
    if (!res.success) { flash("error", res.message ?? "Failed to set reminder."); return; }
    setReminderModal(null);
    flash("success", "Reminder set.");
  }

  async function handleDeleteLead(id: string) {
    if (isAnyActionProcessing) return;
    setIsDeletingId(id);
    try {
      await employeePortalApi.deleteLead(id);
      setConfirmDeleteId(null);
      setOpenActionId(null);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      await load();
    } catch (err: any) {
      const msg = err?.message ?? "";
      flash("error", msg.toLowerCase().includes("converted")
        ? "Cannot delete a converted lead."
        : msg || "Failed to delete lead.");
    } finally { setIsDeletingId(null); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {pendingConvertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
              <p className="font-semibold text-[#1a2035]">Convert to Customer</p>
              <button onClick={() => setPendingConvertId(null)} disabled={converting}
                className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa] disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">Are you sure you want to convert this lead to a customer?</p>
              <p className="mt-1 text-xs text-[#8094ae]">This action cannot be undone.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={handleConfirmConvert} disabled={converting}
                  className="flex-1 rounded-lg bg-[#0971fe] py-2 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
                  {converting ? "Converting…" : "Yes, Convert"}
                </button>
                <button onClick={() => setPendingConvertId(null)} disabled={converting}
                  className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa] disabled:opacity-40">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reminderModal && (
        <ReminderModal
          leadName={reminderModal.leadName}
          onSave={(iso, note) => handleSaveReminder(reminderModal.leadId, iso, note)}
          onClose={() => setReminderModal(null)}
        />
      )}

      <div className="space-y-5">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2035]">My Leads</h1>
            <p className="mt-0.5 text-sm text-[#8094ae]">You have total {leads.length} leads.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative">
              <button onClick={() => !isAnyActionProcessing && setShowExportMenu((p) => !p)} disabled={isAnyActionProcessing}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-[#f5f6fa] disabled:opacity-50">
                <FileSpreadsheet className="h-4 w-4" />Export
                <ChevronDown className="h-3.5 w-3.5 text-[#8094ae]" />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white py-1 shadow-lg">
                    <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#8094ae]">
                      {tabFiltered.length} leads
                    </p>
                    <button onClick={() => { exportCSV(tabFiltered); setShowExportMenu(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />Export as CSV
                    </button>
                    <button onClick={() => { exportXLSX(tabFiltered); setShowExportMenu(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>
            <Link href={isAnyActionProcessing ? "#" : "/employee/leads/new"}
              className={`flex items-center gap-1.5 rounded-lg bg-[#0971fe] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0558d4] ${isAnyActionProcessing ? "pointer-events-none opacity-50" : ""}`}>
              <Plus className="h-4 w-4" />Add Lead
            </Link>
          </div>
        </div>

        {/* Banner */}
        {msg && (
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            msg.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}>
            {msg.type === "success"
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm">

          {/* Tab / Filter bar */}
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-4 py-3">
            <div className="flex items-center gap-1">
              {(["all", "followup", "nofollowup"] as const).map((tab) => {
                const labels = { all: "All", followup: "Follow-up", nofollowup: "No Follow-up" } as const;
                const isActive = activeTab === tab;
                return (
                  <button key={tab} disabled={isAnyActionProcessing}
                    onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      isActive ? "bg-[#0971fe] text-white" : "text-[#8094ae] hover:bg-[#f5f6fa] hover:text-gray-700"
                    }`}>
                    {labels[tab]}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                      isActive ? "bg-white/20 text-white" : "bg-[#f5f6fa] text-[#8094ae]"
                    }`}>{tabCounts[tab]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1">
              {showSearch && (
                <div className="relative mr-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8094ae]" />
                  <input type="text" autoFocus placeholder="Search leads…"
                    value={search} disabled={isAnyActionProcessing}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="h-9 w-44 rounded-lg border border-[#e5e9f2] bg-[#f5f6fa] pl-8 pr-3 text-sm text-gray-700 placeholder:text-[#8094ae] focus:border-[#0971fe] focus:bg-white focus:outline-none disabled:opacity-50" />
                </div>
              )}
              <button onClick={() => !isAnyActionProcessing && setShowSearch((p) => !p)} disabled={isAnyActionProcessing}
                className={`rounded-lg p-2 transition-colors hover:bg-[#f5f6fa] disabled:opacity-50 ${showSearch ? "bg-[#f5f6fa] text-gray-700" : "text-[#8094ae]"}`}>
                <Search className="h-4 w-4" />
              </button>
              <div className="relative">
                <button onClick={() => !isAnyActionProcessing && setShowFilters((p) => !p)} disabled={isAnyActionProcessing}
                  className={`rounded-lg p-2 transition-colors hover:bg-[#f5f6fa] disabled:opacity-50 ${showFilters ? "bg-[#f5f6fa] text-gray-700" : "text-[#8094ae]"}`}>
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                {hasFilters && <span className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-[#0971fe]" />}
                {showFilters && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                    <div className="absolute right-0 z-20 mt-1 w-48 space-y-3 rounded-xl border border-[#e5e9f2] bg-white p-3 shadow-lg">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                        <select value={statusFilter}
                          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                          className="h-8 w-full rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
                          <option value="">All Statuses</option>
                          {["PENDING", "REJECTED"].map((v) => (
                            <option key={v} value={v}>{STATUS_LABELS[v]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">City</label>
                        <select value={cityFilter}
                          onChange={(e) => { setCityFilter(e.target.value); setCurrentPage(1); }}
                          className="h-8 w-full rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
                          <option value="">All Cities</option>
                          {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {hasFilters && (
                        <button onClick={() => { setStatusFilter(""); setCityFilter(""); setCurrentPage(1); }}
                          className="w-full rounded-lg border border-[#e5e9f2] py-1 text-xs text-gray-500 hover:bg-[#f5f6fa]">
                          Clear filters
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e9f2] bg-[#f0f6ff] px-4 py-2.5">
              <span className="text-sm font-medium text-[#1a2035]">
                {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} selected
              </span>
              {!allFilteredSelected && (
                <button onClick={selectAllFiltered} disabled={isAnyActionProcessing} className="text-xs font-medium text-[#0971fe] hover:underline disabled:opacity-50">
                  Select all {tabFiltered.length} leads
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={bulkMarkFollowUp} disabled={isAnyActionProcessing}
                  className="rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-[#f5f6fa] disabled:opacity-50">
                  {isBulkUpdating ? "Updating…" : "Mark as Follow Up"}
                </button>
                <button onClick={bulkMarkUnFollowUp} disabled={isAnyActionProcessing}
                  className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50">
                  {isBulkUpdating ? "Updating…" : "Mark as Un-Follow Up"}
                </button>
                <button onClick={clearSelection} disabled={isAnyActionProcessing} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-white disabled:opacity-50">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <ListSkeleton rows={6} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f6fa]">
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" checked={allPageSelected} disabled={isAnyActionProcessing}
                        ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                        onChange={toggleSelectAll} onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#0971fe] disabled:opacity-50" />
                    </th>
                    {["#", "Name", "Source", "City", "Project Type", "Status", "Follow-up", ""].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-sm text-[#8094ae]">
                        {leads.length === 0 ? "No leads assigned yet." : "No leads match your filters."}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((lead, idx) => {
                      const cfg        = STATUS_CFG[lead.status] ?? STATUS_CFG["PENDING"];
                      const isOpen     = openActionId === lead.id;
                      const rowNum     = String((currentPage - 1) * rowsPerPage + idx + 1).padStart(2, "0");
                      const isSelected = selectedIds.has(lead.id);

                      return (
                        <tr key={lead.id}
                          onClick={(e) => {
                            if (isAnyActionProcessing || (e.target as HTMLElement).closest("button, a, select, input")) return;
                            router.push(`/employee/leads/${lead.id}`);
                          }}
                          className={`border-b border-[#e5e9f2] transition-colors ${isAnyActionProcessing ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-[#f9fafc]"} ${isSelected ? "bg-blue-50/50" : ""}`}>

                          {/* Checkbox */}
                          <td className="w-10 px-3 py-3">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(lead.id)}
                              disabled={isAnyActionProcessing} onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#0971fe] disabled:opacity-50" />
                          </td>

                          {/* # */}
                          <td className="w-10 px-3 py-3">
                            <span className="font-medium text-[#0971fe]">{rowNum}</span>
                          </td>

                          {/* Name + avatar */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(lead.fullName)}`}>
                                {initials(lead.fullName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-800">{lead.fullName}</p>
                                <p className="truncate text-xs text-[#8094ae]">{lead.phone || "—"}</p>
                              </div>
                            </div>
                          </td>

                          {/* Source */}
                          <td className="px-3 py-3">
                            <span className="text-xs text-gray-600">{d.source(lead.source) || "—"}</span>
                          </td>

                          {/* City */}
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1 text-xs text-gray-600">
                              {lead.city ? <MapPin className="h-3 w-3 text-[#8094ae]" /> : null}
                              {lead.city || "—"}
                            </span>
                          </td>

                          {/* Project Type */}
                          <td className="px-3 py-3 text-gray-700">
                            {lead.projectType ?? d.service(lead.serviceType ?? "") ?? "—"}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                              <select value={lead.status} disabled={isAnyActionProcessing}
                                onChange={(e) => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value); }}
                                onClick={(e) => e.stopPropagation()}
                                className={`h-7 rounded-lg border border-[#e5e9f2] bg-white pl-1.5 pr-5 text-xs font-medium focus:border-[#0971fe] focus:outline-none disabled:opacity-50 ${cfg.text}`}>
                                {INLINE_STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Follow-up */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => handleToggleFollowUp(lead.id)} disabled={isAnyActionProcessing}
                                className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                                  lead.followUp
                                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                    : "border-[#e5e9f2] bg-white text-gray-600 hover:bg-[#f5f6fa]"
                                }`}>
                                {followUpTogglingId === lead.id ? "..." : lead.followUp ? "Un-Follow Up" : "Follow Up"}
                              </button>
                              <button disabled={isAnyActionProcessing}
                                onClick={() => setReminderModal({ leadId: lead.id, leadName: lead.fullName })}
                                title="Set reminder"
                                className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa] hover:text-[#0971fe] disabled:opacity-50">
                                <Bell className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="relative px-3 py-3">
                            <button disabled={isAnyActionProcessing}
                              onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : lead.id); }}
                              className="rounded-lg p-1.5 text-[#8094ae] transition-colors hover:bg-[#f5f6fa] hover:text-gray-700 disabled:opacity-50">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {isOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => { setOpenActionId(null); setConfirmDeleteId(null); }} />
                                <div className="absolute right-10 top-1/2 z-20 w-44 -translate-y-1/2 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white py-1 shadow-lg">
                                  <Link href={`/employee/leads/${lead.id}`} onClick={() => setOpenActionId(null)}
                                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                                    <Eye className="h-3.5 w-3.5 text-[#8094ae]" />View
                                  </Link>
                                  {lead.status !== "CONVERTED" && (
                                    <button onClick={(e) => { e.stopPropagation(); setPendingConvertId(lead.id); setOpenActionId(null); }}
                                      className="flex w-full items-center gap-2.5 border-t border-[#e5e9f2] px-4 py-2 text-sm text-purple-600 hover:bg-purple-50">
                                      <UserCheck className="h-3.5 w-3.5" />Convert
                                    </button>
                                  )}
                                  {confirmDeleteId === lead.id ? (
                                    <div className="border-t border-[#e5e9f2] px-4 py-2">
                                      <p className="mb-2 text-xs text-gray-500">Delete this lead?</p>
                                      <div className="flex gap-1.5">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id); }}
                                          className="flex-1 rounded-lg bg-red-500 py-1 text-xs font-medium text-white hover:bg-red-600">
                                          Yes
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                          className="flex-1 rounded-lg border border-[#e5e9f2] py-1 text-xs text-gray-500 hover:bg-[#f5f6fa]">
                                          No
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(lead.id); }}
                                      className="flex w-full items-center gap-2.5 border-t border-[#e5e9f2] px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                      <Trash2 className="h-3.5 w-3.5" />Delete Lead
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

          {/* Pagination */}
          {!isLoading && tabFiltered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e9f2] px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-[#8094ae]">
                <span>Rows per page:</span>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <button key={n} onClick={() => { setRowsPerPage(n); setCurrentPage(1); }}
                    className={`rounded px-2 py-0.5 text-xs ${rowsPerPage === n ? "bg-[#0971fe] text-white" : "hover:bg-[#f5f6fa]"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-[#8094ae]">
                <span>{showingFrom}–{showingTo} of {tabFiltered.length}</span>
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="rounded-lg border border-[#e5e9f2] p-1.5 hover:bg-[#f5f6fa] disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="rounded-lg border border-[#e5e9f2] p-1.5 hover:bg-[#f5f6fa] disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
