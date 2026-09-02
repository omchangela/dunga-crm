"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  Calculator, X, ChevronDown, FileSpreadsheet, Download, Plus,
  FileDown, Eye, Loader2,
} from "lucide-react";
import { fetchAllProjects, projectsApi } from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { PdfViewerModal } from "@/components/shared/pdf-viewer-modal";

const STATUS_CFG: Record<string, { dot: string; text: string; bg: string }> = {
  Pending:  { dot: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  Rejected: { dot: "bg-red-400",    text: "text-red-600",    bg: "bg-red-50 border-red-200"       },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const AVATAR_COLORS = [
  "bg-blue-500","bg-purple-500","bg-emerald-500","bg-orange-500",
  "bg-pink-500","bg-teal-500","bg-indigo-500","bg-rose-500",
];
function avatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function exportCSV(projects: any[]) {
  const rows = projects.map((p) => ({
    "Project Name": p.projectName || p.headline || "—",
    "Project Type": p.projectType || "—",
    "Client Name":  p.clientName || "—",
    "Status":       p.status,
    "Created At":   new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  }));
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `estimation_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EstimationPage() {
  const router = useRouter();
  const [projects, setProjects]         = useState<any[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter]     = useState("");
  const [showSearch, setShowSearch]     = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [showExport, setShowExport]     = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);
  const [rowsPerPage, setRowsPerPage]   = useState<10 | 25 | 50>(10);

  // Detail modal
  const [selected, setSelected]         = useState<any | null>(null);
  // Convert sub-modal
  const [showConvert, setShowConvert]   = useState(false);
  const [converting,  setConverting]    = useState(false);
  const [finalPayments, setFinalPayments] = useState<{ description: string; amount: string }[]>([]);
  const [toast, setToast]               = useState<string | null>(null);
  type PdfJobState = { jobId: string; state: string; progress: number; message: string; result: any };
  const [pdfJobs, setPdfJobs]   = useState<Record<string, PdfJobState | null>>({});
  const pdfIntervalsRef         = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [viewer, setViewer]     = useState<{ url: string; title: string } | null>(null);

  useEffect(() => () => {
    Object.values(pdfIntervalsRef.current).forEach(clearInterval);
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const { projects } = await fetchAllProjects({ status: "PENDING,REJECTED", limit: "500" });
      setProjects(projects);
    } catch {
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Queue an async estimation PDF job, then poll until done.
  async function handleGenerateRowPdf(proj: any, e: React.MouseEvent) {
    e.stopPropagation();
    const existing = pdfJobs[proj.id];
    if (existing?.state === "queued" || existing?.state === "waiting" || existing?.state === "active") return;
    try {
      const res = await projectsApi.generatePdf(proj.id);
      const jobId = res?.data?.jobId;
      if (!jobId) { showToast("Failed to queue PDF generation."); return; }
      setPdfJobs((p) => ({ ...p, [proj.id]: { jobId, state: "queued", progress: 0, message: "Queued…", result: null } }));
      if (pdfIntervalsRef.current[proj.id]) clearInterval(pdfIntervalsRef.current[proj.id]);
      pdfIntervalsRef.current[proj.id] = setInterval(async () => {
        try {
          const status = await projectsApi.getPdfStatus(proj.id, jobId);
          const d = status?.data ?? status;
          setPdfJobs((p) => ({ ...p, [proj.id]: { jobId, state: d.state, progress: d.progress ?? 0, message: d.message ?? "", result: d.result ?? null } }));
          if (d.state === "completed") {
            clearInterval(pdfIntervalsRef.current[proj.id]);
            delete pdfIntervalsRef.current[proj.id];
            showToast("PDF generated");
            await load();
            const signedUrl = d.result?.signedUrl ?? d.result?.downloadUrl;
            if (signedUrl) setViewer({ url: signedUrl, title: `${proj.projectName || "Project"} — Estimation PDF` });
            setPdfJobs((p) => ({ ...p, [proj.id]: null }));
          }
          if (d.state === "failed") {
            clearInterval(pdfIntervalsRef.current[proj.id]);
            delete pdfIntervalsRef.current[proj.id];
            showToast(d.error || "PDF generation failed");
            setPdfJobs((p) => ({ ...p, [proj.id]: { jobId, state: "failed", progress: 0, message: d.error || "Failed", result: null } }));
          }
        } catch { /* keep polling on transient errors */ }
      }, 2000);
    } catch (err: any) {
      showToast(err?.message ?? "Failed to generate PDF.");
    }
  }

  // Open the already-generated estimation PDF via a signed download URL.
  async function handleViewRowPdf(proj: any, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await projectsApi.getPdf(proj.id);
      const downloadUrl = res?.data?.downloadUrl ?? res?.data?.signedUrl;
      if (downloadUrl) setViewer({ url: downloadUrl, title: `${proj.projectName || "Project"} — Estimation PDF` });
      else showToast("Generate PDF first");
    } catch (err: any) {
      if (err?.status === 404) showToast("Generate PDF first");
      else showToast(err?.message ?? "Failed to open PDF.");
    }
  }

  function handleStatusChange(proj: any, newStatus: string) {
    if (newStatus === "Converted") {
      const existing =
        Array.isArray(proj.payments) && proj.payments.length > 0
          ? proj.payments.map((p: any) => ({ description: p.description ?? "", amount: String(p.amount ?? "") }))
          : [{ description: "", amount: String(proj.budget ?? "") }];
      setFinalPayments(existing);
      setShowConvert(true);
      return;
    }
    projectsApi.update(proj.id, { status: toEnum.status(newStatus) })
      .then(async () => {
        await load();
        setSelected(null);
        showToast(newStatus === "Rejected" ? "Marked as Rejected." : "Status updated.");
      })
      .catch((err: any) => showToast(err?.message ?? "Failed to update status."));
  }

  const finalTotal = finalPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const updateFinalPayment = (index: number, field: "description" | "amount", value: string) =>
    setFinalPayments((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [field]: value };
      return arr;
    });
  const addFinalPayment = () =>
    setFinalPayments((prev) => [...prev, { description: "", amount: "" }]);
  const removeFinalPayment = (index: number) =>
    setFinalPayments((prev) => prev.filter((_, i) => i !== index));

  async function handleConfirmConvert() {
    if (!selected || converting) return;
    const cleaned = finalPayments.filter((p) => p.description.trim() || String(p.amount).trim());
    setConverting(true);
    try {
      await projectsApi.update(selected.id, { status: "CONVERTED", payments: cleaned });
      setShowConvert(false);
      setSelected(null);
      await load();
      showToast("Project converted and moved to Projects.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to convert project.");
    } finally {
      setConverting(false);
    }
  }

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const name   = (p.projectName || p.headline || "").toLowerCase();
    const client = (p.clientName || "").toLowerCase();
    const type   = (p.projectType || "").toLowerCase();
    const matchSearch = !search || name.includes(q) || client.includes(q) || type.includes(q);
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchType   = !typeFilter   || p.projectType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated   = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const showingFrom = filtered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingTo   = Math.min(currentPage * rowsPerPage, filtered.length);
  const hasActiveFilters   = !!statusFilter || !!typeFilter;
  const uniqueProjectTypes = Array.from(new Set(projects.map((p) => p.projectType).filter(Boolean)));

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />{toast}
        </div>
      )}

      {/* Project Detail Modal */}
      {selected && !showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="font-semibold text-[#1a2035]">{selected.projectName || selected.headline || "—"}</p>
                <div className="flex items-center gap-2 mt-1">
                  {selected.projectType && (
                    <span className="text-[11px] bg-blue-50 border border-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{selected.projectType}</span>
                  )}
                  <span className={`text-[11px] border px-2 py-0.5 rounded-full font-semibold ${STATUS_CFG[selected.status]?.bg ?? "bg-gray-50 border-gray-200"}`}>
                    <span className={STATUS_CFG[selected.status]?.text ?? "text-gray-600"}>{selected.status}</span>
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 mt-0.5">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">

              {/* Client */}
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(selected.clientName || "")}`}>
                  {initials(selected.clientName || "")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{selected.clientName || "—"}</p>
                  <p className="text-xs text-gray-400">Client</p>
                </div>
              </div>

              {/* Points */}
              {selected.points && selected.points.length > 0 && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Project Details</p>
                  {selected.points.map((pt: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />{pt}
                    </div>
                  ))}
                </div>
              )}

              {/* Project Cost — same value as in Customers */}
              {Number(selected.budget) > 0 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-600">Project Cost</span>
                  <span className="text-sm font-bold text-emerald-700">₹{Number(selected.budget).toLocaleString("en-IN")}</span>
                </div>
              )}

              {/* Status change */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Change Status</p>
                <div className="flex gap-2">
                  {(["Pending", "Converted", "Rejected"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={selected.status === s}
                      onClick={() => handleStatusChange(selected, s)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        selected.status === s
                          ? s === "Converted" ? "bg-purple-100 border-purple-300 text-purple-700 cursor-default"
                          : s === "Rejected"  ? "bg-red-100 border-red-300 text-red-600 cursor-default"
                          :                    "bg-yellow-100 border-yellow-300 text-yellow-700 cursor-default"
                          : s === "Converted" ? "bg-white border-purple-200 text-purple-500 hover:bg-purple-50"
                          : s === "Rejected"  ? "bg-white border-red-200 text-red-400 hover:bg-red-50"
                          :                    "bg-white border-yellow-200 text-yellow-500 hover:bg-yellow-50"
                      }`}
                    >
                      {s === "Converted" ? "↑ Convert" : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-3 flex justify-end">
              <button
                onClick={() => router.push(`/customers/${selected.customerId}`)}
                className="text-xs text-[#0971fe] hover:underline font-medium"
              >
                View Customer →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Estimation Convert Modal */}
      {selected && showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="font-semibold text-[#1a2035]">Final Estimation</p>
                <p className="text-xs text-gray-400 mt-0.5">{selected.projectName || selected.headline}</p>
              </div>
              <button onClick={() => setShowConvert(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Review and update each payment before confirming conversion.</p>
                <button
                  type="button"
                  onClick={addFinalPayment}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm"
                  title="Add payment row"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {finalPayments.map((row, index) => (
                  <div key={`final-pay-${index}`} className="flex items-center gap-2">
                    <Input placeholder="Description (e.g. Frontend)" value={row.description}
                      onChange={(e) => updateFinalPayment(index, "description", e.target.value)} className="h-9 text-sm flex-1" />
                    <Input type="number" placeholder="Amount (₹)" value={row.amount}
                      onChange={(e) => updateFinalPayment(index, "amount", e.target.value)} className="h-9 text-sm flex-1" />
                    {finalPayments.length > 1 && (
                      <button type="button" onClick={() => removeFinalPayment(index)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-purple-50 border border-purple-100 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-600">Total Project Cost</span>
                <span className="text-base font-bold text-purple-700">
                  ₹{finalTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
              <button onClick={handleConfirmConvert} disabled={converting}
                className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-60">
                {converting ? "Converting…" : "Confirm & Convert"}
              </button>
              <button onClick={() => setShowConvert(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2035]">Estimation</h1>
          <p className="mt-0.5 text-sm text-[#8094ae]">
            {projects.length} pending &amp; rejected project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setShowExport((p) => !p)}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-[#f5f6fa]">
            <Download className="h-4 w-4" />Export
            <ChevronDown className="h-3.5 w-3.5 text-[#8094ae]" />
          </button>
          {showExport && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white py-1 shadow-lg">
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#8094ae]">{filtered.length} records</p>
                <button onClick={() => { exportCSV(filtered); setShowExport(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />Export as CSV
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm">

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-4 py-3">
          <p className="text-sm text-[#8094ae]">
            Showing <span className="font-medium text-[#1a2035]">{filtered.length}</span> estimations
          </p>
          <div className="flex items-center gap-1">
            {showSearch && (
              <div className="relative mr-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8094ae]" />
                <input type="text" autoFocus placeholder="Search…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="h-9 w-44 rounded-lg border border-[#e5e9f2] bg-[#f5f6fa] pl-8 pr-3 text-sm text-gray-700 placeholder:text-[#8094ae] focus:border-[#0971fe] focus:bg-white focus:outline-none" />
              </div>
            )}
            <button onClick={() => setShowSearch((p) => !p)}
              className={`rounded-lg p-2 hover:bg-[#f5f6fa] ${showSearch ? "bg-[#f5f6fa] text-gray-700" : "text-[#8094ae]"}`}>
              <Search className="h-4 w-4" />
            </button>
            <div className="relative">
              <button onClick={() => setShowFilters((p) => !p)}
                className={`rounded-lg p-2 hover:bg-[#f5f6fa] ${showFilters ? "bg-[#f5f6fa] text-gray-700" : "text-[#8094ae]"}`}>
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              {hasActiveFilters && <span className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-[#0971fe]" />}
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 space-y-3 rounded-xl border border-[#e5e9f2] bg-white p-3 shadow-lg">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                      <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        className="h-8 w-full rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
                        <option value="">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Project Type</label>
                      <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                        className="h-8 w-full rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
                        <option value="">All Types</option>
                        {uniqueProjectTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {hasActiveFilters && (
                      <button onClick={() => { setStatusFilter(""); setTypeFilter(""); setCurrentPage(1); }}
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

        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : projects.length === 0 ? (
          <div className="py-16 text-center">
            <Calculator className="mx-auto mb-4 h-12 w-12 text-[#8094ae]" />
            <h3 className="mb-1 text-base font-semibold text-[#1a2035]">No estimations yet</h3>
            <p className="text-sm text-[#8094ae]">Projects with Pending or Rejected status appear here</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f6fa]">
                    {["#", "Project", "Client", "Status", "Estimation PDF"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="py-14 text-center text-sm text-[#8094ae]">No estimations found.</td></tr>
                  ) : (
                    paginated.map((p, idx) => {
                      const cfg    = STATUS_CFG[p.status] ?? STATUS_CFG["Pending"];
                      const rowNum = String((currentPage - 1) * rowsPerPage + idx + 1).padStart(2, "0");
                      const name   = p.projectName || p.headline || "—";
                      const client = p.clientName || "—";
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelected(p)}
                          className="cursor-pointer border-b border-[#e5e9f2] transition-colors hover:bg-[#f9fafc]"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-[#0971fe]">{rowNum}</td>

                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{name}</p>
                            {p.projectType && <p className="text-xs text-[#8094ae]">{p.projectType}</p>}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(client)}`}>
                                {initials(client)}
                              </div>
                              <p className="truncate font-medium text-gray-800">{client}</p>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              <span className={cfg.text}>{p.status}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {(() => {
                              const job = pdfJobs[p.id];
                              const busy = job?.state === "queued" || job?.state === "waiting" || job?.state === "active";
                              if (busy) return (
                                <div className="flex min-w-[130px] flex-col gap-1">
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <Loader2 className="h-3 w-3 animate-spin text-[#0971fe]" />
                                    <span>{job!.progress > 0 ? `${job!.progress}%` : (job!.message || "Queued…")}</span>
                                  </div>
                                  <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
                                    <div className="h-1 rounded-full bg-[#0971fe] transition-all duration-300"
                                      style={{ width: `${Math.max(job!.progress || 0, 5)}%` }} />
                                  </div>
                                </div>
                              );
                              if (job?.state === "failed") return (
                                <button onClick={(e) => handleGenerateRowPdf(p, e)}
                                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
                                  <FileDown className="h-3.5 w-3.5" />Retry
                                </button>
                              );
                              if (p.estimationPdfUrl) return (
                                <button onClick={(e) => handleViewRowPdf(p, e)}
                                  title="View estimation PDF"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e9f2] text-[#0971fe] hover:bg-[#f0f6ff]">
                                  <Eye className="h-4 w-4" />
                                </button>
                              );
                              return (
                                <button onClick={(e) => handleGenerateRowPdf(p, e)}
                                  title="Generate estimation PDF"
                                  className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]">
                                  <FileDown className="h-3.5 w-3.5" />Generate PDF
                                </button>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-[#e5e9f2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-[#8094ae]">
                <span>Showing <span className="font-semibold text-[#1a2035]">{showingFrom}–{showingTo}</span> of <span className="font-semibold text-[#1a2035]">{filtered.length}</span></span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">Rows:</span>
                  <select value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value) as 10 | 25 | 50); setCurrentPage(1); }}
                    className="h-7 rounded-lg border border-[#e5e9f2] px-2 text-xs text-gray-700 focus:border-[#0971fe] focus:outline-none">
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="flex h-8 items-center gap-1 rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-600 hover:bg-[#f5f6fa] disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" />Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button key={pg} onClick={() => setCurrentPage(pg)}
                    className={`h-8 min-w-[32px] rounded-lg border px-2.5 text-sm font-medium ${pg === currentPage ? "border-[#0971fe] bg-[#0971fe] text-white" : "border-[#e5e9f2] text-gray-600 hover:bg-[#f5f6fa]"}`}>
                    {pg}
                  </button>
                ))}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="flex h-8 items-center gap-1 rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-600 hover:bg-[#f5f6fa] disabled:opacity-40">
                  Next<ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* In-app PDF viewer */}
      {viewer && (
        <PdfViewerModal url={viewer.url} title={viewer.title} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
