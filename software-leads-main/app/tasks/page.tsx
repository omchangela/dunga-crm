"use client";

import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Check, X, CheckSquare, ChevronDown,
  Clock, AlertTriangle, CheckCircle2, SlidersHorizontal, Search, Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  fetchDevelopers, fetchAllProjects, fetchTasks, fetchTaskEnums,
  fetchProjectDevelopers, tasksApi,
} from "@/lib/api";
import type { Task } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { ListSkeleton } from "@/components/ui/skeleton";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const STATUSES   = ["Todo", "In Progress", "Done", "Cancelled"] as const;

const PRIORITY_COLOR: Record<string, string> = {
  Low:    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
  Medium: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  High:   "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  Urgent: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
};
const STATUS_COLOR: Record<string, string> = {
  "Todo":        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  "Done":        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  "Cancelled":   "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
};

const emptyForm = {
  title: "", description: "", assignedTo: "", projectId: "",
  dueDate: "", priority: "Medium" as Task["priority"], status: "Todo" as Task["status"],
};

export default function TasksPage() {
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [devs,     setDevs]     = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [statusFilter,   setStatusFilter]   = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [devFilter,      setDevFilter]      = useState("");

  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(emptyForm);
  const [formError,  setFormError]  = useState("");
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [projectDevs, setProjectDevs] = useState<any[]>([]);
  const [priorityOpts, setPriorityOpts] = useState<string[]>([...PRIORITIES]);
  const [statusOpts,   setStatusOpts]   = useState<string[]>([...STATUSES]);

  function load() {
    setLoading(true);
    fetchTasks().then(setTasks).catch(() => setTasks([])).finally(() => setLoading(false));
    fetchDevelopers().then(setDevs).catch(() => setDevs([]));
    fetchAllProjects({ status: "CONVERTED,ACTIVE,COMPLETED,ON_HOLD,CANCELLED", limit: "500" })
      .then((r) => setProjects(r.projects))
      .catch(() => setProjects([]));
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetchTaskEnums()
      .then((en) => {
        if (en.priorities.length) setPriorityOpts(en.priorities);
        if (en.statuses.length)   setStatusOpts(en.statuses);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.projectId) { setProjectDevs([]); return; }
    let active = true;
    fetchProjectDevelopers(form.projectId)
      .then((list) => { if (active) setProjectDevs(list); })
      .catch(() => { if (active) setProjectDevs([]); });
    return () => { active = false; };
  }, [form.projectId]);

  const devMap  = Object.fromEntries(devs.map((d) => [d.id, d]));
  const projMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const filtered = tasks.filter((t) => {
    if (statusFilter   && t.status     !== statusFilter)   return false;
    if (priorityFilter && t.priority   !== priorityFilter) return false;
    if (devFilter      && t.assignedTo !== devFilter)      return false;
    return true;
  });

  const isOverdue = (t: Task) =>
    t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Done" && t.status !== "Cancelled";

  const counts = {
    Todo:        tasks.filter((t) => t.status === "Todo").length,
    "In Progress": tasks.filter((t) => t.status === "In Progress").length,
    Done:        tasks.filter((t) => t.status === "Done").length,
    Overdue:     tasks.filter(isOverdue).length,
  };

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(task: Task) {
    setEditingId(task.id);
    setForm({
      title: task.title, description: task.description,
      assignedTo: task.assignedTo, projectId: task.projectId ?? "",
      dueDate: task.dueDate ?? "", priority: task.priority, status: task.status,
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim())    { setFormError("Title is required."); return; }
    if (!form.projectId)       { setFormError("Select a project first."); return; }
    if (!form.assignedTo)      { setFormError("Assign to a developer from this project."); return; }
    const body = {
      title:       form.title.trim(),
      description: form.description.trim(),
      projectId:   form.projectId,
      assignedTo:  form.assignedTo,
      dueDate:     form.dueDate || null,
      priority:    form.priority,
      status:      form.status,
    };
    try {
      if (editingId) await tasksApi.update(editingId, body);
      else           await tasksApi.create(body);
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err: any) {
      setFormError(err?.message ?? "Failed to save task.");
    }
  }

  async function handleQuickStatus(task: Task, status: Task["status"]) {
    try {
      await tasksApi.updateStatus(task.id, status);
      await load();
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  }

  async function handleDelete(taskId: string) {
    try {
      await tasksApi.delete(taskId);
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
    setDeleteId(null);
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
              <CheckSquare className="h-3.5 w-3.5 text-blue-300" />
              Task Execution Hub
              <span className="opacity-40">•</span>
              {tasks.length} Total Tasks
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Engineering Tasks
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Manage engineering task queues, developer assignments, priority matrix, and delivery deadlines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add New Task
            </button>
          </div>
        </div>
      </section>

      {/* ══ TOP METRIC KPI CARDS ══ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Pending Tasks",
            value: counts.Todo,
            sub: "Tasks Waiting to Start",
            icon: CheckSquare,
            color: "from-blue-600 to-indigo-600",
          },
          {
            label: "In Progress",
            value: counts["In Progress"],
            sub: "Active Development Tasks",
            icon: Clock,
            color: "from-amber-600 to-orange-600",
          },
          {
            label: "Completed",
            value: counts.Done,
            sub: "Delivered Milestones",
            icon: CheckCircle2,
            color: "from-emerald-600 to-teal-600",
          },
          {
            label: "Overdue Tasks",
            value: counts.Overdue,
            sub: "Requires Immediate Action",
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

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-3xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20 space-y-4">
          <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-3">
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">{editingId ? "Edit Task Details" : "Create New Task Entry"}</p>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-xl p-1 text-slate-400 hover:bg-slate-200/50">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Task Title *</label>
              <input
                placeholder="Task title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Task Description</label>
              <input
                placeholder="Brief task details and scope..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Target Project *</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value, assignedTo: "" }))}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              >
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName || p.projectType}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Assigned Developer *</label>
              <select
                value={form.assignedTo}
                onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))}
                disabled={!form.projectId || projectDevs.length === 0}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none disabled:opacity-50"
              >
                <option value="">{!form.projectId ? "Select project first" : projectDevs.length === 0 ? "No assigned devs" : "Select developer"}</option>
                {projectDevs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.role ? ` — ${d.role}` : ""}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Target Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Priority Level</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Task["priority"] }))}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              >
                {priorityOpts.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
              </select>
            </div>
          </div>
          {formError && <p className="text-xs font-bold text-rose-600">{formError}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700">
              Save Task Entry
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══ TASKS CONTAINER ══ */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        
        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
              <option value="">All Statuses</option>
              {statusOpts.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
              <option value="">All Priorities</option>
              {priorityOpts.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={devFilter} onChange={(e) => setDevFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
              <option value="">All Developers</option>
              {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {(statusFilter || priorityFilter || devFilter) && (
              <button onClick={() => { setStatusFilter(""); setPriorityFilter(""); setDevFilter(""); }}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                Clear
              </button>
            )}
          </div>
          <span className="text-xs font-bold text-slate-400">{filtered.length} Task Entries</span>
        </div>

        {/* Task list */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <ListSkeleton rows={5} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-slate-300">
              <CheckSquare className="h-12 w-12 text-slate-300" />
              <p className="text-xs font-bold text-slate-500">No task entries found.</p>
            </div>
          ) : (
            filtered.map((task) => {
              const dev  = devMap[task.assignedTo];
              const proj = task.projectId ? projMap[task.projectId] : null;
              const overdue = isOverdue(task);
              const isDel = deleteId === task.id;

              return (
                <div key={task.id} className="flex items-start gap-4 px-6 py-4 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                  {/* Status toggle button */}
                  <button
                    onClick={() => {
                      const next: Task["status"] = task.status === "Todo" ? "In Progress"
                        : task.status === "In Progress" ? "Done" : "Todo";
                      handleQuickStatus(task, next);
                    }}
                    title="Click to advance status"
                    className="mt-0.5 shrink-0"
                  >
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${
                      task.status === "Done" ? "border-emerald-500 bg-emerald-500 text-white" : task.status === "In Progress" ? "border-blue-500 bg-blue-50 text-blue-500" : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                    }`}>
                      {task.status === "Done" && <Check className="h-3 w-3 stroke-[3]" />}
                      {task.status === "In Progress" && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                  </button>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-extrabold ${task.status === "Done" ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                        {task.title}
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${PRIORITY_COLOR[task.priority]}`}>
                        {task.priority} Priority
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${STATUS_COLOR[task.status]}`}>
                        {task.status}
                      </span>
                      {overdue && (
                        <span className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 text-[10px] font-bold uppercase">Overdue</span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-semibold pt-1">
                      {dev && (
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold">
                            {dev.name?.[0]?.toUpperCase()}
                          </span>
                          {dev.name}
                        </span>
                      )}
                      {proj && <span>• {proj.projectName || proj.projectType}</span>}
                      {task.dueDate && (
                        <span className={overdue ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
                          • Target: {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {isDel ? (
                      <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1">
                        <span className="text-xs font-bold text-rose-600">Delete?</span>
                        <button onClick={() => handleDelete(task.id)}
                          className="rounded-lg bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-rose-700">Yes</button>
                        <button onClick={() => setDeleteId(null)}
                          className="rounded-lg border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100">No</button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => openEdit(task)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteId(task.id)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
