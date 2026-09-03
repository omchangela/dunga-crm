"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Search, SlidersHorizontal, MoreHorizontal,
  Eye, Pencil, Trash2, ChevronLeft, ChevronRight,
  Code2, X, UserCheck, Layers, Sparkles,
} from "lucide-react";
import { fetchDevelopers, developersApi } from "@/lib/api";
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
  if (!name) return "DV";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const SKILL_COLORS: Record<string, string> = {
  "Frontend Development":  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  "Backend Development":   "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
  "Database Management":   "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  "Server Maintenance":    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  "Mobile Development":    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  "DevOps / CI/CD":        "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300",
  "UI/UX Design":          "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:border-pink-800 dark:text-pink-300",
  "QA / Testing":          "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300",
  "Cloud Services":        "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300",
  "API Development":       "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300",
  "Cybersecurity":         "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  "Machine Learning / AI": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
};

function skillClass(skill: string) {
  return SKILL_COLORS[skill] ?? "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";
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
  const activeDevsCount = developers.filter((d) => d.status === "Active").length;

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
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
              <Code2 className="h-3.5 w-3.5 text-blue-300" />
              Engineering Talent
              <span className="opacity-40">•</span>
              {developers.length} Developers
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Engineering Team Directory
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Manage developer profiles, technical skill matrices, and client project assignments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/developers/new"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-95">
              <Plus className="h-4 w-4" />
              Add Developer
            </Link>
          </div>
        </div>
      </section>

      {/* ══ TOP METRIC KPI CARDS ══ */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Developers",
            value: developers.length,
            sub: "Engineering Team Size",
            icon: Code2,
            color: "from-blue-600 to-indigo-600",
          },
          {
            label: "Active Engineers",
            value: activeDevsCount,
            sub: "Available for Project Delivery",
            icon: UserCheck,
            color: "from-emerald-600 to-teal-600",
          },
          {
            label: "Skill Stack Matrix",
            value: allSkills.length,
            sub: "Unique Tech Stack Capabilities",
            icon: Layers,
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
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{sub}</p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-600/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </section>

      {/* ══ DEVELOPERS DATA TABLE CONTAINER ══ */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Showing <span className="font-extrabold text-slate-900 dark:text-white">{filtered.length}</span> developers
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search developers..."
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
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Skill</label>
                      <select value={skillFilter} onChange={(e) => { setSkillFilter(e.target.value); setCurrentPage(1); }}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                        <option value="">All Skills</option>
                        {allSkills.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {hasActiveFilters && (
                      <button onClick={() => { setStatusFilter(""); setSkillFilter(""); setCurrentPage(1); }}
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
        ) : developers.length === 0 ? (
          <div className="py-16 text-center">
            <Code2 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="mb-1 text-base font-extrabold text-slate-900 dark:text-white">No developers yet</h3>
            <p className="text-xs text-slate-500">Add engineering team members to start assigning project tasks.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold">
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">Developer</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Experience</th>
                    <th className="py-3.5 px-4">Skills Matrix</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={7} className="py-14 text-center text-xs font-semibold text-slate-400">No developers found matching filter criteria.</td></tr>
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
                          className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50">

                          <td className="py-3.5 px-4 font-black text-blue-600 dark:text-blue-400">{rowNum}</td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarBg(dev.name)}`}>
                                {initials(dev.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{dev.name}</p>
                                <p className="text-[11px] text-slate-400 font-medium truncate">{dev.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">{dev.role}</td>

                          <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{dev.experience}</td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {(dev.skills ?? []).slice(0, 3).map((s: string) => (
                                <span key={s} className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${skillClass(s)}`}>
                                  {s}
                                </span>
                              ))}
                              {(dev.skills ?? []).length > 3 && (
                                <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                                  +{dev.skills.length - 3}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-slate-400"}`} />
                              {dev.status}
                            </span>
                          </td>

                          <td className="relative py-3.5 px-4 text-right">
                            <button onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : dev.id); setConfirmDeleteId(null); }}
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {isOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => { setOpenActionId(null); setConfirmDeleteId(null); }} />
                                <div className="absolute right-10 top-1/2 z-20 w-40 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                                  <Link href={`/developers/${dev.id}`} onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <Eye className="h-3.5 w-3.5 text-blue-500" />View Profile
                                  </Link>
                                  <Link href={`/developers/${dev.id}/edit`} onClick={() => setOpenActionId(null)}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <Pencil className="h-3.5 w-3.5 text-slate-400" />Edit Details
                                  </Link>
                                  {confirmDeleteId === dev.id ? (
                                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2">
                                      <p className="mb-2 text-[11px] font-bold text-slate-500">Confirm delete?</p>
                                      <div className="flex gap-1.5">
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(dev.id); }}
                                          className="flex-1 rounded-lg bg-rose-600 py-1 text-[11px] font-bold text-white hover:bg-rose-700">
                                          Yes
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                          className="flex-1 rounded-lg border border-slate-200 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50">
                                          No
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(dev.id); }}
                                      className="flex w-full items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
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
            <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                <span>
                  Showing <span className="font-extrabold text-slate-900 dark:text-white">{showingFrom}–{showingTo}</span> of{" "}
                  <span className="font-extrabold text-slate-900 dark:text-white">{filtered.length}</span> developers
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`h-8 min-w-[32px] rounded-xl border px-2.5 text-xs font-bold ${p === currentPage ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"}`}>
                    {p}
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
