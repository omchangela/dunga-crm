"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Search, SlidersHorizontal, MoreHorizontal,
  Eye, Pencil, Trash2, ChevronLeft, ChevronRight,
  Code2, X,
} from "lucide-react";
import { fetchDevelopers, developersApi } from "@/lib/api";
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

const SKILL_COLORS: Record<string, string> = {
  "Frontend Development":  "bg-blue-50 text-blue-700 border-blue-200",
  "Backend Development":   "bg-purple-50 text-purple-700 border-purple-200",
  "Database Management":   "bg-orange-50 text-orange-700 border-orange-200",
  "Server Maintenance":    "bg-red-50 text-red-700 border-red-200",
  "Mobile Development":    "bg-green-50 text-green-700 border-green-200",
  "DevOps / CI/CD":        "bg-yellow-50 text-yellow-700 border-yellow-200",
  "UI/UX Design":          "bg-pink-50 text-pink-700 border-pink-200",
  "QA / Testing":          "bg-teal-50 text-teal-700 border-teal-200",
  "Cloud Services":        "bg-sky-50 text-sky-700 border-sky-200",
  "API Development":       "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Cybersecurity":         "bg-rose-50 text-rose-700 border-rose-200",
  "Machine Learning / AI": "bg-emerald-50 text-emerald-700 border-emerald-200",
};
function skillClass(skill: string) {
  return SKILL_COLORS[skill] ?? "bg-gray-50 text-gray-700 border-gray-200";
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export default function DevelopersPage() {
  const router = useRouter();
  const [developers, setDevelopers]     = useState<any[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [skillFilter, setSkillFilter]   = useState("");
  const [showSearch, setShowSearch]     = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);
  const [rowsPerPage, setRowsPerPage]   = useState<10 | 25 | 50>(10);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      setDevelopers(await fetchDevelopers());
    } catch {
      setDevelopers([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = developers.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(q) ||
      (d.email ?? "").toLowerCase().includes(q) ||
      (d.role ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || d.status === statusFilter;
    const matchSkill  = !skillFilter  || (d.skills ?? []).includes(skillFilter);
    return matchSearch && matchStatus && matchSkill;
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated   = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const showingFrom = filtered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingTo   = Math.min(currentPage * rowsPerPage, filtered.length);
  const hasActiveFilters = !!statusFilter || !!skillFilter;
  const allSkills = Array.from(new Set(developers.flatMap((d) => d.skills ?? []))).sort();

  async function handleDelete(id: string) {
    try {
      await developersApi.delete(id);
    } catch (err) {
      console.error("Failed to delete developer:", err);
    }
    setConfirmDeleteId(null);
    setOpenActionId(null);
    await load();
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2035]">Developers</h1>
          <p className="mt-0.5 text-sm text-[#8094ae]">{developers.length} total developers</p>
        </div>
        <Link href="/developers/new"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0971fe] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0558d4]">
          <Plus className="h-4 w-4" />Add Developer
        </Link>
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm">

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-4 py-3">
          <p className="text-sm text-[#8094ae]">
            Showing <span className="font-medium text-[#1a2035]">{filtered.length}</span> developers
          </p>
          <div className="flex items-center gap-1">
            {showSearch && (
              <div className="relative mr-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8094ae]" />
                <input type="text" autoFocus placeholder="Search developers…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="h-9 w-48 rounded-lg border border-[#e5e9f2] bg-[#f5f6fa] pl-8 pr-3 text-sm text-gray-700 placeholder:text-[#8094ae] focus:border-[#0971fe] focus:bg-white focus:outline-none" />
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
                  <div className="absolute right-0 z-20 mt-1 w-60 space-y-3 rounded-xl border border-[#e5e9f2] bg-white p-3 shadow-lg">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                      <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        className="h-8 w-full rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
                        <option value="">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Skill</label>
                      <select value={skillFilter} onChange={(e) => { setSkillFilter(e.target.value); setCurrentPage(1); }}
                        className="h-8 w-full rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
                        <option value="">All Skills</option>
                        {allSkills.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {hasActiveFilters && (
                      <button onClick={() => { setStatusFilter(""); setSkillFilter(""); setCurrentPage(1); }}
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
        ) : developers.length === 0 ? (
          <div className="py-16 text-center">
            <Code2 className="mx-auto mb-4 h-12 w-12 text-[#8094ae]" />
            <h3 className="mb-1 text-base font-semibold text-[#1a2035]">No developers yet</h3>
            <p className="text-sm text-[#8094ae]">Add your first developer to get started</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f6fa]">
                    {["#", "Developer", "Role", "Experience", "Skills", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={7} className="py-14 text-center text-sm text-[#8094ae]">No developers found.</td></tr>
                  ) : (
                    paginated.map((dev, idx) => {
                      const isOpen = openActionId === dev.id;
                      const rowNum = String((currentPage - 1) * rowsPerPage + idx + 1).padStart(2, "0");
                      const isActive = dev.status === "Active";
                      return (
                        <tr key={dev.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("button, a, input")) return;
                            router.push(`/developers/${dev.id}`);
                          }}
                          className="cursor-pointer border-b border-[#e5e9f2] transition-colors hover:bg-[#f9fafc]">

                          <td className="px-4 py-3 font-medium text-[#0971fe]">{rowNum}</td>

                          {/* Developer */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(dev.name)}`}>
                                {initials(dev.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-800">{dev.name}</p>
                                <p className="truncate text-xs text-[#8094ae]">{dev.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3 text-gray-600">{dev.role}</td>

                          {/* Experience */}
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dev.experience}</td>

                          {/* Skills */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(dev.skills ?? []).slice(0, 3).map((s: string) => (
                                <span key={s} className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${skillClass(s)}`}>
                                  {s}
                                </span>
                              ))}
                              {(dev.skills ?? []).length > 3 && (
                                <span className="inline-block rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                                  +{dev.skills.length - 3}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${isActive ? "bg-green-400" : "bg-gray-400"}`} />
                              <span className={`font-medium ${isActive ? "text-green-700" : "text-gray-500"}`}>{dev.status}</span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="relative px-3 py-3">
                            <button onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : dev.id); setConfirmDeleteId(null); }}
                              className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa]">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {isOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => { setOpenActionId(null); setConfirmDeleteId(null); }} />
                                <div className="absolute right-10 top-1/2 z-20 w-40 -translate-y-1/2 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white py-1 shadow-lg">
                                  <Link href={`/developers/${dev.id}`} onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                                    <Eye className="h-3.5 w-3.5 text-[#8094ae]" />View
                                  </Link>
                                  <Link href={`/developers/${dev.id}/edit`} onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                                    <Pencil className="h-3.5 w-3.5 text-[#8094ae]" />Edit
                                  </Link>
                                  {confirmDeleteId === dev.id ? (
                                    <div className="border-t border-[#e5e9f2] px-4 py-2">
                                      <p className="mb-2 text-xs text-gray-500">Delete this developer?</p>
                                      <div className="flex gap-1.5">
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(dev.id); }}
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
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(dev.id); }}
                                      className="flex w-full items-center gap-2.5 border-t border-[#e5e9f2] px-4 py-2 text-sm text-red-500 hover:bg-red-50">
                                      <Trash2 className="h-3.5 w-3.5" />Delete
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
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-[#e5e9f2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-[#8094ae]">
                <span>
                  Showing <span className="font-semibold text-[#1a2035]">{showingFrom}–{showingTo}</span> of{" "}
                  <span className="font-semibold text-[#1a2035]">{filtered.length}</span> developers
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`h-8 min-w-[32px] rounded-lg border px-2.5 text-sm font-medium ${p === currentPage ? "border-[#0971fe] bg-[#0971fe] text-white" : "border-[#e5e9f2] text-gray-600 hover:bg-[#f5f6fa]"}`}>
                    {p}
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
