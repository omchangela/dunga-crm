"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Download, Search, SlidersHorizontal,
  MoreHorizontal, Eye, ChevronLeft, ChevronRight,
  Users, X, Pencil, ChevronDown, FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { fetchCustomers } from "@/lib/api";
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
    
    // Safely treat object values as fallback string descriptions
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

  // FIX: Unwraps primitive keys and completely filters out objects that break key attributes
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
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2035]">Customers</h1>
          <p className="mt-0.5 text-sm text-[#8094ae]">{customers.length} total customers</p>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setShowExportMenu((p) => !p)}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-[#f5f6fa]"
          >
            <Download className="h-4 w-4" />Export
            <ChevronDown className="h-3.5 w-3.5 text-[#8094ae]" />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white py-1 shadow-lg">
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#8094ae]">
                  {filtered.length} customers
                </p>
                <button
                  onClick={() => { exportCSV(filtered); setShowExportMenu(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />Export as CSV
                </button>
                <button
                  onClick={() => { exportXLSX(filtered); setShowExportMenu(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]"
                >
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
            Showing <span className="font-medium text-[#1a2035]">{filtered.length}</span> customers
          </p>
          <div className="flex items-center gap-1">
            {showSearch && (
              <div className="relative mr-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8094ae]" />
                <input type="text" autoFocus placeholder="Search customers…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="h-9 w-44 rounded-lg border border-[#e5e9f2] bg-[#f5f6fa] pl-8 pr-3 text-sm text-gray-700 placeholder:text-[#8094ae] focus:border-[#0971fe] focus:bg-white focus:outline-none"
                />
              </div>
            )}
            <button onClick={() => setShowSearch((p) => !p)} className={`rounded-lg p-2 hover:bg-[#f5f6fa] ${showSearch ? "bg-[#f5f6fa] text-gray-700" : "text-[#8094ae]"}`}>
              <Search className="h-4 w-4" />
            </button>
            <div className="relative">
              <button onClick={() => setShowFilters((p) => !p)} className={`rounded-lg p-2 hover:bg-[#f5f6fa] ${showFilters ? "bg-[#f5f6fa] text-gray-700" : "text-[#8094ae]"}`}>
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
                        <option value="Converted">Converted</option>
                        <option value="Pending">Pending</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Project Name</label>
                      <select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
                        className="h-8 w-full rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
                        <option value="">All Projects</option>
                        {uniqueProjectNames.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {hasActiveFilters && (
                      <button onClick={() => { setStatusFilter(""); setProjectFilter(""); setCurrentPage(1); }}
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
        ) : loadError ? (
          <div className="py-16 text-center">
            <p className="mb-2 text-sm font-medium text-red-600">{loadError}</p>
            <button onClick={load} className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-600 hover:bg-[#f5f6fa]">Retry</button>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-[#8094ae]" />
            <h3 className="mb-1 text-base font-semibold text-[#1a2035]">No customers yet</h3>
            <p className="text-sm text-[#8094ae]">Converted leads will appear here</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f6fa]">
                    {["#","Name","Total Projects","Project Pipeline",""].map((h, hIdx) => (
                      <th key={`th-${hIdx}`} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="py-14 text-center text-sm text-[#8094ae]">No customers found.</td></tr>
                  ) : (
                    paginated.map((c, idx) => {
                      const isOpen = openActionId === c.id;
                      const rowNum = String((currentPage - 1) * rowsPerPage + idx + 1).padStart(2, "0");
                      return (
                        <tr
                          key={c.id || `row-${idx}`}
                          onClick={(e) => handleRowClick(e, c.id)}
                          className="cursor-pointer border-b border-[#e5e9f2] transition-colors hover:bg-[#f9fafc]"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-[#0971fe]">{rowNum}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(c.fullName || "")}`}>
                                {initials(c.fullName || "")}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-800">{c.fullName}</p>
                                <p className="truncate text-xs text-[#8094ae]">{c.phone}</p>
                            
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center rounded-full bg-[#f0f6ff] px-3 py-1 text-sm font-semibold text-[#0971fe]">
                              {c.totalProjects ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const s = c.pipeline ?? { pending: 0, converted: 0, rejected: 0 };
                              const total = s.pending + s.converted + s.rejected;
                              if (total === 0) return <span className="text-xs text-gray-400">No projects</span>;
                              return (
                                <div className="flex items-center gap-1.5">
                                  {s.pending > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />{s.pending} Pending
                                    </span>
                                  )}
                                  {s.converted > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />{s.converted} Converted
                                    </span>
                                  )}
                                  {s.rejected > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />{s.rejected} Rejected
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="relative px-3 py-3">
                            <button onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : c.id); }} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa]">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {isOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenActionId(null)} />
                                <div className="absolute right-10 top-1/2 z-20 w-36 -translate-y-1/2 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white py-1 shadow-lg">
                                  <Link
                                    href={`/customers/${c.id}`}
                                    onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-[#8094ae]" />View
                                  </Link>
                                  <Link
                                    href={`/customers/${c.id}/edit`}
                                    onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-[#8094ae]" />Edit
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
                  <span className="font-semibold text-[#1a2035]">{filtered.length}</span> customers
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
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex h-8 items-center gap-1 rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-600 hover:bg-[#f5f6fa] disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" />Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={`page-${p}`} onClick={() => setCurrentPage(p)} className={`h-8 min-w-[32px] rounded-lg border px-2.5 text-sm font-medium ${p === currentPage ? "border-[#0971fe] bg-[#0971fe] text-white" : "border-[#e5e9f2] text-gray-600 hover:bg-[#f5f6fa]"}`}>{p}</button>
                ))}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex h-8 items-center gap-1 rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-600 hover:bg-[#f5f6fa] disabled:opacity-40">
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