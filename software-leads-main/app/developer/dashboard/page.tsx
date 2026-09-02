"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FolderKanban, CheckSquare, AlertTriangle, CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { developerApi } from "@/lib/developerApi";
import { useDeveloperAuth } from "@/contexts/DeveloperAuthContext";

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
const PROJECT_STATUS_LABELS: Record<string, string> = {
  CONVERTED: "Active", ACTIVE: "Active", COMPLETED: "Completed",
  ON_HOLD: "On Hold", CANCELLED: "Cancelled",
};
const PROJECT_STATUS_COLORS: Record<string, string> = {
  CONVERTED: "bg-green-50 text-green-700 border-green-200",
  ACTIVE:    "bg-green-50 text-green-700 border-green-200",
  COMPLETED: "bg-blue-50 text-blue-700 border-blue-200",
  ON_HOLD:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ icon, label, value, danger }: {
  icon: React.ReactNode; label: string; value: number; danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#e5e9f2] bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f6ff]">{icon}</div>
      <p className={`mt-3 text-2xl font-bold ${danger && value > 0 ? "text-red-600" : "text-[#1a2035]"}`}>{value}</p>
      <p className="text-sm font-medium text-[#8094ae]">{label}</p>
    </div>
  );
}

export default function DeveloperDashboardPage() {
  const { developer } = useDeveloperAuth();
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    developerApi.dashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpdateStatus(taskId: string, status: string) {
    setUpdatingId(taskId);
    try {
      await developerApi.tasks.updateStatus(taskId, status);
      showToast(`Task updated to "${status}"`);
      const fresh = await developerApi.dashboard();
      setData(fresh);
    } catch {
      showToast("Failed to update task.");
    } finally {
      setUpdatingId(null);
    }
  }

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
    </div>
  );

  const stats         = data?.stats ?? {};
  const recentTasks   = data?.recentTasks   ?? [];
  const recentProjects = data?.recentProjects ?? [];
  const total         = (stats.todoTasks ?? 0) + (stats.inProgressTasks ?? 0) + (stats.doneTasks ?? 0);
  const donePercent   = total > 0 ? Math.round(((stats.doneTasks ?? 0) / total) * 100) : 0;
  const inPctWidth    = total > 0 ? Math.round(((stats.inProgressTasks ?? 0) / total) * 100) : 0;

  return (
    <div className="space-y-6">

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{toast}
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a2035]">{greeting}, {developer?.name?.split(" ")[0]} 👋</h1>
        <p className="mt-0.5 text-sm text-[#8094ae]">{developer?.role}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<FolderKanban className="h-5 w-5 text-teal-600" />}     label="My Projects"    value={stats.totalProjects   ?? 0} />
        <StatCard icon={<Clock        className="h-5 w-5 text-blue-500" />}     label="Pending Tasks"  value={(stats.todoTasks ?? 0) + (stats.inProgressTasks ?? 0)} />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />}     label="Overdue"        value={stats.overdueTasks    ?? 0} danger />
        <StatCard icon={<CheckCircle2  className="h-5 w-5 text-green-500" />}   label="Completed"      value={stats.doneTasks        ?? 0} />
      </div>

      {/* Task progress bar */}
      {total > 0 && (
        <div className="rounded-xl border border-[#e5e9f2] bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-[#1a2035]">Task Progress</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
            <div style={{ width: `${donePercent}%` }}    className="bg-green-500 transition-all duration-500" />
            <div style={{ width: `${inPctWidth}%` }}     className="bg-blue-500 transition-all duration-500" />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span className="text-green-600">● Done ({stats.doneTasks ?? 0})</span>
            <span className="text-blue-600">● In Progress ({stats.inProgressTasks ?? 0})</span>
            <span className="text-gray-500">● Todo ({stats.todoTasks ?? 0})</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recent Tasks */}
        <div className="rounded-xl border border-[#e5e9f2] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-semibold text-[#1a2035]">Pending Tasks</span>
            </div>
            <Link href="/developer/tasks"
              className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#e5e9f2]">
            {recentTasks.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#8094ae]">No pending tasks.</p>
            ) : recentTasks.slice(0, 5).map((t: any) => (
              <div key={t.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1a2035]">{t.title}</p>
                    {t.project && (
                      <p className="truncate text-xs text-[#8094ae]">{t.project.projectName}</p>
                    )}
                    <p className="mt-0.5 text-xs text-[#8094ae]">
                      Due: {t.dueDate ? formatDate(t.dueDate) : "—"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {t.priority && (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                          {t.priority}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${TASK_STATUS_COLORS[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                  <select
                    value={t.status}
                    disabled={updatingId === t.id}
                    onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                    className="h-7 shrink-0 rounded-lg border border-[#e5e9f2] px-1.5 text-xs text-gray-600 focus:border-teal-500 focus:outline-none disabled:opacity-50"
                  >
                    {["Todo", "In Progress", "In Review", "Done"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="rounded-xl border border-[#e5e9f2] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-semibold text-[#1a2035]">My Projects</span>
            </div>
            <Link href="/developer/projects"
              className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#e5e9f2]">
            {recentProjects.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#8094ae]">No projects assigned.</p>
            ) : recentProjects.slice(0, 5).map((p: any) => (
              <Link key={p.id} href={`/developer/projects/${p.id}`}
                className="block px-5 py-3 hover:bg-[#f9fafc] transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1a2035]">{p.projectName}</p>
                    <p className="truncate text-xs text-[#8094ae]">Client: {p.clientName}</p>
                    <p className="mt-0.5 text-xs text-[#8094ae]">
                      Deadline: {p.deadline ? formatDate(p.deadline) : "—"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${PROJECT_STATUS_COLORS[p.status] ?? ""}`}>
                    {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
