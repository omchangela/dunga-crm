"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal, Eye, ChevronLeft, ChevronRight, FolderKanban,
} from "lucide-react";
import Link from "next/link";
import { employeePortalApi } from "@/lib/api";
import { ListSkeleton } from "@/components/ui/skeleton";

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

const STATUS_COLORS: Record<string, string> = {
  CONVERTED: "bg-purple-50 text-purple-600 border border-purple-200",
  ACTIVE:    "bg-green-50 text-green-700 border border-green-200",
  COMPLETED: "bg-blue-50 text-blue-700 border border-blue-200",
  ON_HOLD:   "bg-yellow-50 text-yellow-700 border border-yellow-200",
  CANCELLED: "bg-red-50 text-red-600 border border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  CONVERTED: "Converted",
  ACTIVE:    "Active",
  COMPLETED: "Completed",
  ON_HOLD:   "On Hold",
  CANCELLED: "Cancelled",
};
const SERVICE_TYPE_LABELS: Record<string, string> = {
  WEB_DEVELOPMENT:     "Web Development",
  APP_DEVELOPMENT:     "App Development",
  APP_WEB_DEVELOPMENT: "App + Web Development",
  DIGITAL_MARKETING:   "Digital Marketing",
  DESIGN_SERVICES:     "Design Services",
  OTHERS:              "Others",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export default function EmployeeProjectsPage() {
  const router = useRouter();
  const [projects, setProjects]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<10 | 25 | 50>(10);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  useEffect(() => {
    employeePortalApi.projects()
      .then((data: any) => {
        const raw: any[] = Array.isArray(data?.projects) ? data.projects
          : Array.isArray(data?.data?.projects) ? data.data.projects
          : Array.isArray(data) ? data : [];
        setProjects(raw);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const totalPages  = Math.max(1, Math.ceil(projects.length / rowsPerPage));
  const paginated   = projects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const showingFrom = projects.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingTo   = Math.min(currentPage * rowsPerPage, projects.length);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a2035]">My Projects</h1>
        <p className="mt-0.5 text-sm text-[#8094ae]">{projects.length} total projects</p>
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm">

        {/* Count bar */}
        <div className="border-b border-[#e5e9f2] px-4 py-2.5">
          <p className="text-sm text-[#8094ae]">
            Showing <span className="font-medium text-[#1a2035]">{projects.length}</span> projects
          </p>
        </div>

        {loading ? (
          <ListSkeleton rows={6} />
        ) : projects.length === 0 ? (
          <div className="py-16 text-center">
            <FolderKanban className="mx-auto mb-4 h-12 w-12 text-[#8094ae]" />
            <h3 className="mb-1 text-base font-semibold text-[#1a2035]">No projects yet</h3>
            <p className="text-sm text-[#8094ae]">Convert a lead to create a customer, then add a project</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f6fa]">
                    {["#", "Project", "Client", "Deadline", "Team", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p, idx) => {
                    const statusKey = String(p.status ?? "").toUpperCase();
                    const isOpen    = openActionId === p.id;
                    const rowNum    = String((currentPage - 1) * rowsPerPage + idx + 1).padStart(2, "0");
                    const devs: any[] = Array.isArray(p.developers)
                      ? p.developers.filter((d: any) => typeof d === "object" && d?.name)
                      : [];
                    return (
                      <tr key={p.id}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button, a, select, input")) return;
                          router.push(`/employee/projects/${p.id}`);
                        }}
                        className="cursor-pointer border-b border-[#e5e9f2] transition-colors hover:bg-[#f9fafc]">

                        <td className="px-4 py-3 text-sm font-medium text-[#0971fe]">{rowNum}</td>

                        {/* Project */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{p.projectName ?? "—"}</p>
                          {p.serviceType && (
                            <p className="text-xs text-[#8094ae]">{SERVICE_TYPE_LABELS[p.serviceType] ?? p.serviceType}</p>
                          )}
                        </td>

                        {/* Client */}
                        <td className="px-4 py-3">
                          {p.clientName ? (
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(p.clientName)}`}>
                                {initials(p.clientName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-800">{p.clientName}</p>
                                {p.phone && <p className="truncate text-xs text-[#8094ae]">{p.phone}</p>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#8094ae]">—</span>
                          )}
                        </td>

                        {/* Deadline */}
                        <td className="px-4 py-3 text-sm">
                          {p.deadline ? (() => {
                            const due   = new Date(p.deadline); due.setHours(0, 0, 0, 0);
                            const today = new Date(); today.setHours(0, 0, 0, 0);
                            const overdue = due < today && statusKey !== "COMPLETED";
                            return (
                              <span className={`inline-flex items-center gap-1.5 font-semibold ${overdue ? "text-red-600" : "text-green-600"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${overdue ? "bg-red-400" : "bg-green-400"}`} />
                                {new Date(p.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            );
                          })() : <span className="text-[#8094ae]">—</span>}
                        </td>

                        {/* Team */}
                        <td className="px-4 py-3">
                          {devs.length === 0 ? (
                            <span className="text-[#8094ae]">—</span>
                          ) : (
                            <div className="flex items-center -space-x-2">
                              {devs.slice(0, 3).map((d, i) => (
                                <div key={d.id ?? i} title={d.name}
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white ${avatarBg(d.name)}`}>
                                  {initials(d.name)}
                                </div>
                              ))}
                              {devs.length > 3 && (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#e5e9f2] text-[10px] font-semibold text-[#8094ae]">
                                  +{devs.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium w-fit
                            ${STATUS_COLORS[statusKey] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {STATUS_LABELS[statusKey] ?? p.status}
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
                                <Link href={`/employee/projects/${p.id}`}
                                  onClick={() => setOpenActionId(null)}
                                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]">
                                  <Eye className="h-3.5 w-3.5 text-[#8094ae]" />View
                                </Link>
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-[#e5e9f2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-[#8094ae]">
                <span>
                  Showing <span className="font-semibold text-[#1a2035]">{showingFrom}–{showingTo}</span> of{" "}
                  <span className="font-semibold text-[#1a2035]">{projects.length}</span> projects
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
