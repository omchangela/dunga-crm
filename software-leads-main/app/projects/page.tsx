"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, MoreHorizontal, Eye,
  ChevronLeft, ChevronRight, FolderKanban, X, Download,
  ChevronDown, FileSpreadsheet, CheckCircle2, DollarSign, Activity, Clock,
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { fetchAllProjects, fetchDevelopers } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
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
  if (!name) return "PR";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const STATUS_CFG: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  Active:    { dot: "bg-emerald-400",  text: "text-emerald-700 dark:text-emerald-300",  bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800" },
  Completed: { dot: "bg-blue-400",   text: "text-blue-700 dark:text-blue-300",   bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800" },
  "On Hold": { dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800" },
  Cancelled: { dot: "bg-rose-400",    text: "text-rose-700 dark:text-rose-300",    bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800" },
  Converted: { dot: "bg-purple-400", text: "text-purple-700 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800" },
};

const ALL_STATUSES = ["Active", "Completed", "On Hold", "Cancelled", "Converted"];
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

// ── Export ────────────────────────────────────────────────────────────────────
function buildExportRows(projects: any[]) {
  return projects.map((p) => ({
    "Project Name":   p.projectName,
    "Project Type":   p.projectType,
    "Client Name":    p.clientName,
    "Phone":          p.phone,
    "Email":          p.email ?? "",
    "Budget":         p.budget ?? 0,
    "Status":         p.status,
    "Contract No.":   p.contractNumber ?? "",
    "Created At":     new Date(p.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    }),
  }));
}

function exportCSV(projects: any[]) {
  const rows = buildExportRows(projects);
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
  a.href = url; a.download = `projects_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportXLSX(projects: any[]) {
  const rows = buildExportRows(projects);
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0]).map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String((r as any)[k]).length)) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Projects");
  XLSX.writeFile(wb, `projects_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
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
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [allDevs, setAllDevs]           = useState<any[]>([]);

  async function load() {
    setIsLoading(true);
    try {
      const { projects } = await fetchAllProjects({
        status: "CONVERTED,ACTIVE,COMPLETED,ON_HOLD,CANCELLED",
        limit: "500",
      });
      setProjects(projects);
    } catch {
      setProjects([]);
    } finally {
      fetchDevelopers().then(setAllDevs).catch(() => setAllDevs([]));
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      p.projectName.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      (p.projectType ?? "").toLowerCase().includes(q);
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

  const activeProjectsCount = projects.filter((p) => p.status === "Active" || p.status === "Converted").length;
  const completedProjectsCount = projects.filter((p) => p.status === "Completed").length;
  const totalBudgetValue = projects.reduce((sum, p) => sum + (p.budget || 0), 0);

  return (
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
              <FolderKanban className="h-3.5 w-3.5 text-blue-300" />
              Software Projects
              <span className="opacity-40">•</span>
              {projects.length} Total Projects
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Project Delivery Hub
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Track software delivery milestones, engineering assignments, and client project budgets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowExport((p) => !p)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
              </button>
              {showExport && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 shadow-xl">
                    <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {filtered.length} Projects
                    </p>
                    <button onClick={() => { exportCSV(filtered); setShowExport(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <FileSpreadsheet className="h-4 w-4 text-blue-500" /> Export as CSV
                    </button>
                    <button onClick={() => { exportXLSX(filtered); setShowExport(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Projects",
            value: projects.length,
            sub: "Total Project Catalog",
            icon: FolderKanban,
            color: "from-blue-600 to-indigo-600",
          },
          {
            label: "Active Delivery",
            value: activeProjectsCount,
            sub: `${activeProjectsCount} In Progress`,
            icon: Activity,
            color: "from-emerald-600 to-teal-600",
          },
          {
            label: "Completed",
            value: completedProjectsCount,
            sub: "Delivered Successfully",
            icon: CheckCircle2,
            color: "from-indigo-600 to-purple-600",
          },
          {
            label: "Total Pipeline Budget",
            value: formatCurrency(totalBudgetValue),
            sub: "Contracted Project Revenue",
            icon: DollarSign,
            color: "from-amber-600 to-orange-600",
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

      {/* ══ PROJECTS DATA TABLE CONTAINER ══ */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Showing <span className="font-extrabold text-slate-900 dark:text-white">{filtered.length}</span> projects
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects..."
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
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
            <FolderKanban className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="mb-1 text-base font-extrabold text-slate-900 dark:text-white">No projects yet</h3>
            <p className="text-xs text-slate-500">Projects are created automatically when a lead is converted.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold">
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">Project Name</th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Target Deadline</th>
                    <th className="py-3.5 px-4">Assigned Team</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={7} className="py-14 text-center text-xs font-semibold text-slate-400">No projects found.</td></tr>
                  ) : (
                    paginated.map((p, idx) => {
                      const cfg    = STATUS_CFG[p.status] ?? STATUS_CFG["Active"];
                      const isOpen = openActionId === p.id;
                      const rowNum = String((currentPage - 1) * rowsPerPage + idx + 1).padStart(2, "0");
                      return (
                        <tr
                          key={p.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("button, a, select, input")) return;
                            router.push(`/projects/${p.id}`);
                          }}
                          className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3.5 px-4 font-black text-blue-600 dark:text-blue-400">{rowNum}</td>

                          <td className="py-3.5 px-4">
                            <p className="font-extrabold text-slate-900 dark:text-white text-sm">{p.projectName}</p>
                            {p.projectType && (
                              <p className="text-[11px] text-slate-400 font-medium">{p.projectType}</p>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarBg(p.clientName)}`}>
                                {initials(p.clientName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-extrabold text-slate-900 dark:text-white">{p.clientName}</p>
                                <p className="truncate text-[11px] text-slate-400 font-medium">{p.phone}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {p.deadline ? (() => {
                              const due = new Date(p.deadline); due.setHours(0, 0, 0, 0);
                              const today = new Date(); today.setHours(0, 0, 0, 0);
                              const overdue = due < today && p.status !== "Completed";
                              return (
                                <span className={`inline-flex items-center gap-1.5 font-bold ${overdue ? "text-rose-600" : "text-emerald-600"}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${overdue ? "bg-rose-500" : "bg-emerald-500"}`} />
                                  {new Date(p.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                              );
                            })() : (
                              <span className="text-slate-400 font-medium">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {(() => {
                              const devIds: string[] = p.developers ?? [];
                              if (devIds.length === 0) return <span className="text-slate-400 font-medium">—</span>;
                              const assigned = allDevs.filter((d) => devIds.includes(d.id));
                              const show     = assigned.slice(0, 3);
                              const extra    = assigned.length - show.length;
                              return (
                                <div className="flex items-center -space-x-2">
                                  {show.map((d) => (
                                    <div key={d.id} title={d.name}
                                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 text-[10px] font-bold text-white shadow-sm ${avatarBg(d.name)}`}>
                                      {initials(d.name)}
                                    </div>
                                  ))}
                                  {extra > 0 && (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                      +{extra}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {p.status}
                            </span>
                          </td>

                          <td className="relative py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : p.id); }}
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {isOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenActionId(null)} />
                                <div className="absolute right-10 top-1/2 z-20 w-36 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                                  <Link
                                    href={`/projects/${p.id}`}
                                    onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-blue-500" />View Workspace
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
                  <span className="font-extrabold text-slate-900 dark:text-white">{filtered.length}</span> projects
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
    </div>
  );
}
