"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Download, Search, SlidersHorizontal,
  MoreHorizontal, Eye, ChevronLeft, ChevronRight,
  Users, X, Pencil, ChevronDown, FileSpreadsheet,
  UserCheck, FolderKanban, TrendingUp, Building2,
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { fetchCustomers } from "@/lib/api";
import { ListSkeleton } from "@/components/ui/skeleton";

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (!name) return "CU";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

// ── Export helpers ────────────────────────────────────────────────────────────

function buildExportRows(customers: any[]) {
  return customers.map((c) => ({
    "Client Name":     c.fullName,
    "Phone":           c.phone,
    "Email":           c.email ?? "",
    "Project Type":    c.projectType ?? "",
    "Contract Number": c.applicationNumber ?? "",
    "Status":          c.status ?? "Active",
    "Created At":      c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    }) : "",
  }));
}

function exportCSV(customers: any[]) {
  const rows = buildExportRows(customers);
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
  a.href     = url;
  a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportXLSX(customers: any[]) {
  const rows = buildExportRows(customers);
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0]).map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String((r as any)[k]).length)) + 2,
  }));
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, `customers_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch]                   = useState("");
  const [statusFilter, setStatusFilter]       = useState("");
  const [projectFilter, setProjectFilter]     = useState("");
  const [showSearch, setShowSearch]           = useState(false);
  const [showFilters, setShowFilters]         = useState(false);
  const [showExportMenu, setShowExportMenu]   = useState(false);
  const [currentPage, setCurrentPage]         = useState(1);
  const [rowsPerPage, setRowsPerPage]         = useState<10 | 25 | 50>(10);
  const [openActionId, setOpenActionId]       = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { customers: custs } = await fetchCustomers({ page: "1", limit: "500" });
      setCustomers(custs);
    } catch (err: any) {
      setLoadError(err?.message ?? "Failed to load customers.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.loanType ?? "").toLowerCase().includes(q);
    const matchStatus  = !statusFilter  || c.status === statusFilter;
    
    const projectValue = typeof c.loanType === 'object' && c.loanType !== null 
      ? (c.loanType.name || JSON.stringify(c.loanType)) 
      : String(c.loanType || "");

    const matchProject = !projectFilter || projectValue === projectFilter;
    return matchSearch && matchStatus && matchProject;
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated   = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const showingFrom = filtered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingTo   = Math.min(currentPage * rowsPerPage, filtered.length);
  const hasActiveFilters  = !!statusFilter || !!projectFilter;

  const totalProjectsCount = customers.reduce((sum, c) => sum + (c.totalProjects || 0), 0);

  const uniqueProjectNames = Array.from(
    new Set(
      customers.map((c) => {
        if (!c.loanType) return "";
        if (typeof c.loanType === "object") return c.loanType.name || JSON.stringify(c.loanType);
        return String(c.loanType);
      }).filter(Boolean)
    )
  );

  function handleRowClick(e: React.MouseEvent, id: string) {
    if ((e.target as HTMLElement).closest("button, a, select, input")) return;
    router.push(`/customers/${id}`);
  }

  return (
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
              <Users className="h-3.5 w-3.5 text-blue-300" />
              Customer Accounts
              <span className="opacity-40">•</span>
              {customers.length} Accounts Registered
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Customer Directory
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Overview of converted client accounts, active projects, and contract history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((p) => !p)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 active:scale-95"
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
                      {filtered.length} Customers
                    </p>
                    <button
                      onClick={() => { exportCSV(filtered); setShowExportMenu(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-blue-500" /> Export as CSV
                    </button>
                    <button
                      onClick={() => { exportXLSX(filtered); setShowExportMenu(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══ TOP METRIC KPI CARDS ══ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: "Total Accounts",
            value: customers.length,
            sub: "Converted Client Accounts",
            icon: Users,
            color: "from-blue-600 to-indigo-600",
          },
          {
            label: "Total Client Projects",
            value: totalProjectsCount,
            sub: "Associated Delivery Projects",
            icon: FolderKanban,
            color: "from-emerald-600 to-teal-600",
          },
          {
            label: "Active Relationships",
            value: customers.length,
            sub: "Registered Accounts in System",
            icon: UserCheck,
            color: "from-indigo-600 to-purple-600",
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

      {/* ══ CUSTOMERS DATA TABLE CONTAINER ══ */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Showing <span className="font-extrabold text-slate-900 dark:text-white">{filtered.length}</span> customers
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search customers..."
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
                        <option value="Converted">Converted</option>
                        <option value="Pending">Pending</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Project Type</label>
                      <select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                        <option value="">All Projects</option>
                        {uniqueProjectNames.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {hasActiveFilters && (
                      <button onClick={() => { setStatusFilter(""); setProjectFilter(""); setCurrentPage(1); }}
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
        ) : loadError ? (
          <div className="py-16 text-center">
            <p className="mb-2 text-sm font-semibold text-rose-600">{loadError}</p>
            <button onClick={load} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Retry</button>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="mb-1 text-base font-extrabold text-slate-900 dark:text-white">No customers yet</h3>
            <p className="text-xs text-slate-500">Converted leads will appear here automatically.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold">
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">Name & Contact</th>
                    <th className="py-3.5 px-4 text-center">Total Projects</th>
                    <th className="py-3.5 px-4">Project Pipeline</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="py-14 text-center text-xs font-semibold text-slate-400">No customers found matching filter criteria.</td></tr>
                  ) : (
                    paginated.map((c, idx) => {
                      const isOpen = openActionId === c.id;
                      const rowNum = String((currentPage - 1) * rowsPerPage + idx + 1).padStart(2, "0");
                      return (
                        <tr
                          key={c.id || `row-${idx}`}
                          onClick={(e) => handleRowClick(e, c.id)}
                          className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3.5 px-4 font-black text-blue-600 dark:text-blue-400">{rowNum}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarBg(c.fullName || "")}`}>
                                {initials(c.fullName || "")}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{c.fullName}</p>
                                <p className="text-[11px] text-slate-400 font-medium truncate">{c.phone || c.email || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-xs font-extrabold text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                              {c.totalProjects ?? 0} Projects
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {(() => {
                              const s = c.pipeline ?? { pending: 0, converted: 0, rejected: 0 };
                              const total = s.pending + s.converted + s.rejected;
                              if (total === 0) return <span className="text-xs text-slate-400 font-medium">No projects</span>;
                              return (
                                <div className="flex items-center gap-1.5">
                                  {s.pending > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{s.pending} Pending
                                    </span>
                                  )}
                                  {s.converted > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{s.converted} Active
                                    </span>
                                  )}
                                  {s.rejected > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />{s.rejected} Cancelled
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="relative py-3.5 px-4 text-right">
                            <button onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : c.id); }} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {isOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenActionId(null)} />
                                <div className="absolute right-10 top-1/2 z-20 w-36 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                                  <Link
                                    href={`/customers/${c.id}`}
                                    onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-blue-500" />View Profile
                                  </Link>
                                  <Link
                                    href={`/customers/${c.id}/edit`}
                                    onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-slate-400" />Edit Details
                                  </Link>
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
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                <span>
                  Showing <span className="font-extrabold text-slate-900 dark:text-white">{showingFrom}–{showingTo}</span> of{" "}
                  <span className="font-extrabold text-slate-900 dark:text-white">{filtered.length}</span> customers
                </span>
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
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" />Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={`page-${p}`} onClick={() => setCurrentPage(p)} className={`h-8 min-w-[32px] rounded-xl border px-2.5 text-xs font-bold ${p === currentPage ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"}`}>{p}</button>
                ))}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 disabled:opacity-40">
                  Next<ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}