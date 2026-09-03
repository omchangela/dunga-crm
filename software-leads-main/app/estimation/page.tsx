"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  Calculator, X, ChevronDown, FileSpreadsheet, Download, Plus,
  FileDown, Eye, Loader2, FileText, CheckCircle2, AlertTriangle, ArrowRight,
} from "lucide-react";
import { fetchAllProjects, projectsApi } from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { PdfViewerModal } from "@/components/shared/pdf-viewer-modal";

const STATUS_CFG: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  Pending:  { dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800" },
  Rejected: { dot: "bg-rose-400",    text: "text-rose-700 dark:text-rose-300",    bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800" },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const AVATAR_COLORS = [
  "bg-gradient-to-br from-blue-600 to-indigo-700",
  "bg-gradient-to-br from-violet-600 to-purple-700",
  "bg-gradient-to-br from-emerald-600 to-teal-700",
  "bg-gradient-to-br from-amber-600 to-orange-700",
  "bg-gradient-to-br from-rose-600 to-pink-700",
  "bg-gradient-to-br from-cyan-600 to-blue-700",
  "bg-gradient-to-br from-slate-700 to-slate-900",
];

function avatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  if (!name) return "ES";
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
            showToast("PDF generated successfully");
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
        } catch {}
      }, 2000);
    } catch (err: any) {
      showToast(err?.message ?? "Failed to generate PDF.");
    }
  }

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
      showToast("Project converted and moved to active Projects.");
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

  const pendingCount = projects.filter((p) => p.status === "Pending").length;
  const rejectedCount = projects.filter((p) => p.status === "Rejected").length;

  return (
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
              <Calculator className="h-3.5 w-3.5 text-blue-300" />
              Estimation Generator
              <span className="opacity-40">•</span>
              {projects.length} Total Estimations
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Project Proposals & Estimations
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Review project quotes, generate formal PDF proposals, and convert proposals to active client projects.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button onClick={() => setShowExport((p) => !p)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 active:scale-95">
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
              </button>
              {showExport && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 shadow-xl">
                    <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{filtered.length} Records</p>
                    <button onClick={() => { exportCSV(filtered); setShowExport(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <FileSpreadsheet className="h-4 w-4 text-blue-500" /> Export as CSV
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══ TOP METRIC KPI CARDS ══ */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Estimations",
            value: projects.length,
            sub: "Total Pending & Rejected Quotes",
            icon: Calculator,
            color: "from-blue-600 to-indigo-600",
          },
          {
            label: "Pending Approvals",
            value: pendingCount,
            sub: "Awaiting Client Sign-off",
            icon: FileText,
            color: "from-amber-600 to-orange-600",
          },
          {
            label: "Rejected Proposals",
            value: rejectedCount,
            sub: "Quotes Not Accepted",
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

      {/* Toast Notification */}
      {toast && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {toast}
        </div>
      )}

      {/* Project Detail Modal */}
      {selected && !showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-5">
              <div>
                <p className="font-extrabold text-slate-900 dark:text-white text-base">{selected.projectName || selected.headline || "—"}</p>
                <div className="flex items-center gap-2 mt-1">
                  {selected.projectType && (
                    <span className="text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-600 px-2.5 py-0.5 rounded-full dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">{selected.projectType}</span>
                  )}
                  <span className={`text-[11px] border px-2.5 py-0.5 rounded-full font-bold ${STATUS_CFG[selected.status]?.bg ?? "bg-slate-50 border-slate-200"}`}>
                    <span className={STATUS_CFG[selected.status]?.text ?? "text-slate-600"}>{selected.status}</span>
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarBg(selected.clientName || "")}`}>
                  {initials(selected.clientName || "")}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{selected.clientName || "—"}</p>
                  <p className="text-xs text-slate-400 font-medium">Client Contact</p>
                </div>
              </div>

              {selected.points && selected.points.length > 0 && (
                <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-4 space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Proposal Scope Items</p>
                  {selected.points.map((pt: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />{pt}
                    </div>
                  ))}
                </div>
              )}

              {Number(selected.budget) > 0 && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200/80 px-4 py-3 flex items-center justify-between dark:bg-emerald-950/40 dark:border-emerald-800">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Estimated Budget</span>
                  <span className="text-sm font-black text-emerald-800 dark:text-emerald-200">₹{Number(selected.budget).toLocaleString("en-IN")}</span>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">Update Proposal Status</p>
                <div className="flex gap-2">
                  {(["Pending", "Converted", "Rejected"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={selected.status === s}
                      onClick={() => handleStatusChange(selected, s)}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                        selected.status === s
                          ? s === "Converted" ? "bg-purple-100 border-purple-300 text-purple-700 cursor-default"
                          : s === "Rejected"  ? "bg-rose-100 border-rose-300 text-rose-600 cursor-default"
                          :                    "bg-amber-100 border-amber-300 text-amber-700 cursor-default"
                          : s === "Converted" ? "bg-white border-purple-200 text-purple-600 hover:bg-purple-50"
                          : s === "Rejected"  ? "bg-white border-rose-200 text-rose-600 hover:bg-rose-50"
                          :                    "bg-white border-amber-200 text-amber-600 hover:bg-amber-50"
                      }`}
                    >
                      {s === "Converted" ? "↑ Convert" : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex justify-end">
              <button
                onClick={() => router.push(`/customers/${selected.customerId}`)}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                View Customer Profile <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Estimation Convert Modal */}
      {selected && showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Convert to Active Project</p>
                <p className="text-xs text-slate-400 mt-0.5">{selected.projectName || selected.headline}</p>
              </div>
              <button onClick={() => setShowConvert(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Configure payment milestones for the project contract.</p>
                <button
                  type="button"
                  onClick={addFinalPayment}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition shadow-sm"
                  title="Add milestone"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                {finalPayments.map((row, index) => (
                  <div key={`final-pay-${index}`} className="flex items-center gap-2">
                    <Input placeholder="Milestone description" value={row.description}
                      onChange={(e) => updateFinalPayment(index, "description", e.target.value)} className="h-10 text-xs font-semibold rounded-xl" />
                    <Input type="number" placeholder="Amount (₹)" value={row.amount}
                      onChange={(e) => updateFinalPayment(index, "amount", e.target.value)} className="h-10 text-xs font-semibold rounded-xl" />
                    {finalPayments.length > 1 && (
                      <button type="button" onClick={() => removeFinalPayment(index)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-purple-50 border border-purple-200 px-4 py-3 flex items-center justify-between dark:bg-purple-950/40 dark:border-purple-800">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Total Project Value</span>
                <span className="text-sm font-black text-purple-800 dark:text-purple-200">
                  ₹{finalTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
              <button onClick={handleConfirmConvert} disabled={converting}
                className="flex-1 rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-purple-700 transition disabled:opacity-60 shadow-md">
                {converting ? "Converting..." : "Confirm & Convert"}
              </button>
              <button onClick={() => setShowConvert(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50">
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ESTIMATIONS DATA TABLE CONTAINER ══ */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Showing <span className="font-extrabold text-slate-900 dark:text-white">{filtered.length}</span> estimations
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search estimations..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="h-10 w-64 rounded-xl border border-slate-200/80 bg-slate-50 pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white dark:border-slate-800 dark:bg-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
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

            <div className="relative">
              <button
                onClick={() => setShowFilters((p) => !p)}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  hasActiveFilters
                    ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/50"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
              </button>
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-60 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
                      <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                        <option value="">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Project Type</label>
                      <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                        <option value="">All Types</option>
                        {uniqueProjectTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {hasActiveFilters && (
                      <button onClick={() => { setStatusFilter(""); setTypeFilter(""); setCurrentPage(1); }}
                        className="w-full rounded-xl border border-slate-200 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400">
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
            <Calculator className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="mb-1 text-base font-extrabold text-slate-900 dark:text-white">No estimations found</h3>
            <p className="text-xs text-slate-500">Projects with Pending or Rejected status will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold">
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">Project Headline</th>
                    <th className="py-3.5 px-4">Client Contact</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Proposal PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="py-14 text-center text-xs font-semibold text-slate-400">No estimations found matching filter criteria.</td></tr>
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
                          className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3.5 px-4 font-black text-blue-600 dark:text-blue-400">{rowNum}</td>

                          <td className="py-3.5 px-4">
                            <p className="font-extrabold text-slate-900 dark:text-white text-sm">{name}</p>
                            {p.projectType && <p className="text-[11px] text-slate-400 font-medium">{p.projectType}</p>}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarBg(client)}`}>
                                {initials(client)}
                              </div>
                              <p className="truncate font-extrabold text-slate-900 dark:text-white">{client}</p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {p.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {(() => {
                              const job = pdfJobs[p.id];
                              const busy = job?.state === "queued" || job?.state === "waiting" || job?.state === "active";
                              if (busy) return (
                                <div className="flex min-w-[130px] flex-col items-end gap-1 ml-auto">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>{job!.progress > 0 ? `${job!.progress}%` : (job!.message || "Queued...")}</span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
                                      style={{ width: `${Math.max(job!.progress || 0, 5)}%` }} />
                                  </div>
                                </div>
                              );
                              if (job?.state === "failed") return (
                                <button onClick={(e) => handleGenerateRowPdf(p, e)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100">
                                  <FileDown className="h-3.5 w-3.5" />Retry PDF
                                </button>
                              );
                              if (p.estimationPdfUrl) return (
                                <button onClick={(e) => handleViewRowPdf(p, e)}
                                  title="View estimation PDF"
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                                  <Eye className="h-3.5 w-3.5" />View PDF
                                </button>
                              );
                              return (
                                <button onClick={(e) => handleGenerateRowPdf(p, e)}
                                  title="Generate estimation PDF"
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                                  <FileDown className="h-3.5 w-3.5 text-slate-400" />Generate PDF
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
            <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                <span>Showing <span className="font-extrabold text-slate-900 dark:text-white">{showingFrom}–{showingTo}</span> of <span className="font-extrabold text-slate-900 dark:text-white">{filtered.length}</span></span>
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value) as 10 | 25 | 50); setCurrentPage(1); }}
                    className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none">
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" />Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button key={pg} onClick={() => setCurrentPage(pg)}
                    className={`h-8 min-w-[32px] rounded-xl border px-2.5 text-xs font-bold ${pg === currentPage ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"}`}>
                    {pg}
                  </button>
                ))}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 disabled:opacity-40">
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
