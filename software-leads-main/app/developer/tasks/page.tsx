"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckSquare, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { developerApi } from "@/lib/developerApi";

const TASK_STATUS_COLORS: Record<string, string> = {
  Todo:          "bg-gray-50 text-gray-700 border-gray-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  "In Review":   "bg-purple-50 text-purple-700 border-purple-200",
  Done:          "bg-green-50 text-green-700 border-green-200",
};
const PRIORITY_COLORS: Record<string, string> = {
  High:   "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Low:    "bg-blue-50 text-blue-700 border-blue-200",
};
const STATUS_OPTIONS    = ["", "Todo", "In Progress", "In Review", "Done"];
const PRIORITY_OPTIONS  = ["", "High", "Medium", "Low"];
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DeveloperTasksPage() {
  const [tasks,       setTasks]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [statusFilter,   setStatusFilter]   = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [projectFilter,  setProjectFilter]  = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<10 | 25 | 50>(10);
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);
  const [toast,       setToast]       = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(() => {
    setLoading(true);
    developerApi.tasks.list()
      .then((data: any) => {
        setTasks(Array.isArray(data) ? data : []);
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpdateStatus(taskId: string, newStatus: string) {
    setUpdatingId(taskId);
    try {
      await developerApi.tasks.updateStatus(taskId, newStatus);
      showToast(`Task updated to "${newStatus}"`);
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch {
      showToast("Failed to update task.");
    } finally {
      setUpdatingId(null);
    }
  }

  const uniqueProjects = Array.from(
    new Map(
      tasks
        .filter((t) => t.project?.id)
        .map((t) => [t.project.id, t.project.projectName])
    ).entries()
  );

  const filtered = tasks.filter((t) => {
    if (statusFilter   && t.status          !== statusFilter)   return false;
    if (priorityFilter && t.priority        !== priorityFilter) return false;
    if (projectFilter  && t.project?.id     !== projectFilter)  return false;
    return true;
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated   = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const showingFrom = filtered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingTo   = Math.min(currentPage * rowsPerPage, filtered.length);

  function resetPage() { setCurrentPage(1); }

  return (
    <div className="space-y-5">

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-[#1a2035]">My Tasks</h1>
        <p className="mt-0.5 text-sm text-[#8094ae]">{tasks.length} tasks assigned</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e9f2] px-4 py-3">
          <select value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
            className="h-8 rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s || "All Statuses"}</option>
            ))}
          </select>
          <select value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); resetPage(); }}
            className="h-8 rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none">
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p || "All Priorities"}</option>
            ))}
          </select>
          {uniqueProjects.length > 0 && (
            <select value={projectFilter}
              onChange={(e) => { setProjectFilter(e.target.value); resetPage(); }}
              className="h-8 rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none">
              <option value="">All Projects</option>
              {uniqueProjects.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          {(statusFilter || priorityFilter || projectFilter) && (
            <button
              onClick={() => { setStatusFilter(""); setPriorityFilter(""); setProjectFilter(""); resetPage(); }}
              className="rounded-lg border border-[#e5e9f2] px-2.5 py-1 text-xs text-gray-500 hover:bg-[#f5f6fa]">
              Clear
            </button>
          )}
          <span className="ml-auto text-sm text-[#8094ae]">
            <span className="font-medium text-[#1a2035]">{filtered.length}</span> tasks
          </span>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center">
            <CheckSquare className="mx-auto mb-4 h-12 w-12 text-[#8094ae]" />
            <h3 className="mb-1 text-base font-semibold text-[#1a2035]">No tasks assigned</h3>
            <p className="text-sm text-[#8094ae]">Tasks assigned to you will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f6fa]">
                    {["#", "Task", "Project", "Priority", "Due Date", "Status", "Update"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8094ae]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-sm text-[#8094ae]">
                        No {statusFilter} tasks found.
                      </td>
                    </tr>
                  ) : paginated.map((t, idx) => {
                    const overdue = t.dueDate && t.status !== "Done" && new Date(t.dueDate) < new Date();
                    const rowNum  = String((currentPage - 1) * rowsPerPage + idx + 1).padStart(2, "0");
                    return (
                      <tr key={t.id} className="border-b border-[#e5e9f2] hover:bg-[#f9fafc]">

                        <td className="px-4 py-3 text-sm font-medium text-teal-600">{rowNum}</td>

                        <td className="px-4 py-3 max-w-[220px]">
                          <p className="font-medium text-gray-800 truncate">{t.title}</p>
                          {t.description && (
                            <p className="mt-0.5 truncate text-xs text-[#8094ae]">
                              {t.description.slice(0, 60)}{t.description.length > 60 ? "…" : ""}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm text-[#8094ae] max-w-[160px]">
                          <span className="truncate block">{t.project?.projectName ?? "—"}</span>
                        </td>

                        <td className="px-4 py-3">
                          {t.priority ? (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                              {t.priority}
                            </span>
                          ) : <span className="text-[#8094ae]">—</span>}
                        </td>

                        <td className="px-4 py-3 text-sm">
                          {t.dueDate ? (
                            <span className={`inline-flex items-center gap-1.5 ${overdue ? "text-red-600 font-semibold" : "text-[#8094ae]"}`}>
                              {overdue && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
                              {formatDate(t.dueDate)}
                              {overdue && (
                                <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">
                                  Overdue
                                </span>
                              )}
                            </span>
                          ) : <span className="text-[#8094ae]">—</span>}
                        </td>

                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TASK_STATUS_COLORS[t.status] ?? ""}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {t.status}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={t.status}
                            disabled={updatingId === t.id}
                            onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                            className="h-8 rounded-lg border border-[#e5e9f2] bg-white px-2 text-xs text-gray-600 focus:border-teal-500 focus:outline-none disabled:opacity-50 min-w-[110px]"
                          >
                            {["Todo", "In Progress", "In Review", "Done"].map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
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
                  <span className="font-semibold text-[#1a2035]">{filtered.length}</span> tasks
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">Rows:</span>
                  <select value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value) as 10|25|50); resetPage(); }}
                    className="h-7 rounded-lg border border-[#e5e9f2] px-2 text-xs text-gray-700 focus:border-teal-500 focus:outline-none">
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
                    className={`h-8 min-w-[32px] rounded-lg border px-2.5 text-sm font-medium ${pg === currentPage ? "border-teal-600 bg-teal-600 text-white" : "border-[#e5e9f2] text-gray-600 hover:bg-[#f5f6fa]"}`}>
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
