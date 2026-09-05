"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, MoreHorizontal, Eye,
  ChevronLeft, ChevronRight, FolderKanban, X, Download,
  ChevronDown, FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { fetchAllProjects, fetchDevelopers } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ListSkeleton } from "@/components/ui/skeleton";

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const STATUS_CFG: Record<string, { dot: string; text: string; bg: string }> = {
  Active:    { dot: "bg-green-400",  text: "text-green-700",  bg: "bg-green-50 border-green-200"    },
  Completed: { dot: "bg-blue-400",   text: "text-blue-700",   bg: "bg-blue-50 border-blue-200"      },
  "On Hold": { dot: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200"  },
  Cancelled: { dot: "bg-red-400",    text: "text-red-600",    bg: "bg-red-50 border-red-200"        },
  Converted: { dot: "bg-purple-400", text: "text-purple-700", bg: "bg-purple-50 border-purple-200"  },
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
      // Pending/Rejected customer estimations go to /estimation; show everything else here
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

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2035]">Projects</h1>
          <p className="mt-0.5 text-sm text-[#8094ae]">{projects.length} total projects</p>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowExport((p) => !p)}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-[#f5f6fa]"
          >
            <Download className="h-4 w-4" />Export
            <ChevronDown className="h-3.5 w-3.5 text-[#8094ae]" />
          </button>
          {showExport && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white py-1 shadow-lg">
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#8094ae]">
                  {filtered.length} projects
                </p>
                <button onClick={() => { exportCSV(filtered); setShowExport(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />Export as CSV
                </button>
                <button onClick={() => { exportXLSX(filtered); setShowExport(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />Export as Excel
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm">

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-4 py-3">
          <p className="text-sm text-[#8094ae]">
            Showing <span className="font-medium text-[#1a2035]">{filtered.length}</span> projects
          </p>
          <div className="flex items-center gap-1">
            {showSearch && (
              <div className="relative mr-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8094ae]" />
                <input type="text" autoFocus placeholder="Search projects…" value={search}
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
                        <option value="">All Statuses</option>
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
            <FolderKanban className="mx-auto mb-4 h-12 w-12 text-[#8094ae]" />
            <h3 className="mb-1 text-base font-semibold text-[#1a2035]">No projects yet</h3>
            <p className="text-sm text-[#8094ae]">Projects are created automatically when a lead is converted</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f6fa]">
                    {["#", "Project Name", "Client", "Deadline", "Team", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={7} className="py-14 text-center text-sm text-[#8094ae]">No projects found.</td></tr>
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
                          className="cursor-pointer border-b border-[#e5e9f2] transition-colors hover:bg-[#f9fafc]"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-[#0971fe]">{rowNum}</td>

                          {/* Project Name */}
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{p.projectName}</p>
                            {p.projectType && (
                              <p className="text-xs text-[#8094ae]">{p.projectType}</p>
                            )}
                          </td>

                          {/* Client */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(p.clientName)}`}>
                                {initials(p.clientName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-800">{p.clientName}</p>
                                <p className="truncate text-xs text-[#8094ae]">{p.phone}</p>
                              </div>
                            </div>
                          </td>

                          {/* Deadline */}
                          <td className="px-4 py-3 text-sm">
                            {p.deadline ? (() => {
                              const due = new Date(p.deadline); due.setHours(0, 0, 0, 0);
                              const today = new Date(); today.setHours(0, 0, 0, 0);
                              const overdue = due < today && p.status !== "Completed";
                              return (
                                <span className={`inline-flex items-center gap-1.5 font-semibold ${overdue ? "text-red-600" : "text-green-600"}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${overdue ? "bg-red-400" : "bg-green-400"}`} />
                                  {new Date(p.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                              );
                            })() : (
                              <span className="text-[#8094ae]">—</span>
                            )}
                          </td>

                          {/* Team */}
                          <td className="px-4 py-3">
                            {(() => {
                              const devIds: string[] = p.developers ?? [];
                              if (devIds.length === 0) return <span className="text-[#8094ae]">—</span>;
                              const assigned = allDevs.filter((d) => devIds.includes(d.id));
                              const show     = assigned.slice(0, 3);
                              const extra    = assigned.length - show.length;
                              return (
                                <div className="flex items-center -space-x-2">
                                  {show.map((d) => (
                                    <div key={d.id} title={d.name}
                                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white ${avatarBg(d.name)}`}>
                                      {initials(d.name)}
                                    </div>
                                  ))}
                                  {extra > 0 && (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#e5e9f2] text-[10px] font-semibold text-[#8094ae]">
                                      +{extra}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              <span className={cfg.text}>{p.status}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="relative px-3 py-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : p.id); }}
                              className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa]">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {isOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenActionId(null)} />
                                <div className="absolute right-10 top-1/2 z-20 w-36 -translate-y-1/2 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white py-1 shadow-lg">
                                  <Link
                                    href={`/projects/${p.id}`}
                                    onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-[#8094ae]" />View
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
            <div className="flex flex-col gap-3 border-t border-[#e5e9f2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-[#8094ae]">
                <span>
                  Showing <span className="font-semibold text-[#1a2035]">{showingFrom}–{showingTo}</span> of{" "}
                  <span className="font-semibold text-[#1a2035]">{filtered.length}</span> projects
                </span>
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
    </div>
  );
}
