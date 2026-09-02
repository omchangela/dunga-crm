"use client";

import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Check, X, CheckSquare, ChevronDown,
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

// Fallbacks used until /api/tasks/enums responds.
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const STATUSES   = ["Todo", "In Progress", "Done", "Cancelled"] as const;

const PRIORITY_COLOR: Record<string, string> = {
  Low:    "bg-gray-100 text-gray-600",
  Medium: "bg-blue-100 text-blue-700",
  High:   "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};
const STATUS_COLOR: Record<string, string> = {
  "Todo":        "bg-gray-100 text-gray-600",
  "In Progress": "bg-blue-100 text-blue-700",
  "Done":        "bg-green-100 text-green-700",
  "Cancelled":   "bg-red-100 text-red-600",
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

  // Load developers assigned to the project selected in the form.
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

  const counts = {
    Todo:        tasks.filter((t) => t.status === "Todo").length,
    "In Progress": tasks.filter((t) => t.status === "In Progress").length,
    Done:        tasks.filter((t) => t.status === "Done").length,
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

  const isOverdue = (t: Task) =>
    t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Done" && t.status !== "Cancelled";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2035]">Tasks</h1>
          <p className="mt-0.5 text-sm text-[#8094ae]">Manage developer tasks across projects</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" />Add Task
        </Button>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["Todo", "In Progress", "Done"] as const).map((s) => (
          <button key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            className={`rounded-xl border p-4 text-left shadow-sm transition-all
              ${statusFilter === s ? "border-[#0971fe] bg-[#f0f6ff]" : "border-[#e5e9f2] bg-white hover:bg-[#f8f9fc]"}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-[#8094ae]">{s}</p>
            <p className="mt-1.5 text-2xl font-bold text-[#1a2035]">{counts[s as keyof typeof counts] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-xl border border-dashed border-[#0971fe] bg-[#f0f6ff] p-5 space-y-4">
          <p className="text-sm font-bold text-[#1a2035]">{editingId ? "Edit Task" : "New Task"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Title *</Label>
              <Input placeholder="Task title"
                value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Input placeholder="Brief description"
                value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Project *</Label>
              <Select
                value={form.projectId}
                onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value, assignedTo: "" }))}
                placeholder="Select project"
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName || p.projectType}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assign To *</Label>
              <Select
                value={form.assignedTo}
                onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))}
                placeholder={!form.projectId ? "Select a project first" : projectDevs.length === 0 ? "No developers assigned" : "Select developer"}
                disabled={!form.projectId || projectDevs.length === 0}
              >
                {projectDevs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.role ? ` — ${d.role}` : ""}</option>)}
              </Select>
              {form.projectId && projectDevs.length === 0 && (
                <p className="text-[11px] text-amber-600">No developers assigned to this project yet — assign them in the project first.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Task["priority"] }))}>
                {priorityOpts.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Task["status"] }))}>
                {statusOpts.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}><Check className="mr-1 h-3.5 w-3.5" />Save</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
          <option value="">All Statuses</option>
          {statusOpts.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-8 rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
          <option value="">All Priorities</option>
          {priorityOpts.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={devFilter} onChange={(e) => setDevFilter(e.target.value)}
          className="h-8 rounded-lg border border-[#e5e9f2] px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
          <option value="">All Developers</option>
          {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {(statusFilter || priorityFilter || devFilter) && (
          <button onClick={() => { setStatusFilter(""); setPriorityFilter(""); setDevFilter(""); }}
            className="h-8 rounded-lg border border-[#e5e9f2] px-3 text-xs text-gray-500 hover:bg-[#f5f6fa]">
            Clear
          </button>
        )}
        <span className="ml-auto self-center text-xs text-[#8094ae]">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Task list */}
      <div className="overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-sm divide-y">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-[#8094ae]">
            <CheckSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">No tasks found.</p>
          </div>
        ) : (
          filtered.map((task) => {
            const dev  = devMap[task.assignedTo];
            const proj = task.projectId ? projMap[task.projectId] : null;
            const overdue = isOverdue(task);
            const isDel = deleteId === task.id;

            return (
              <div key={task.id} className="flex items-start gap-4 px-5 py-4 hover:bg-[#f8f9fc] transition-colors">
                {/* Status circle */}
                <button
                  onClick={() => {
                    const next: Task["status"] = task.status === "Todo" ? "In Progress"
                      : task.status === "In Progress" ? "Done" : "Todo";
                    handleQuickStatus(task, next);
                  }}
                  title="Click to advance status"
                  className="mt-0.5 shrink-0"
                >
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${task.status === "Done" ? "border-green-500 bg-green-500" : task.status === "In Progress" ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:border-blue-400"}`}>
                    {task.status === "Done" && <Check className="h-3 w-3 text-white" />}
                    {task.status === "In Progress" && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                  </div>
                </button>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${task.status === "Done" ? "line-through text-[#8094ae]" : "text-[#1a2035]"}`}>
                      {task.title}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLOR[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[task.status]}`}>
                      {task.status}
                    </span>
                    {overdue && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600">Overdue</span>
                    )}
                  </div>
                  {task.description && (
                    <p className="mt-0.5 text-xs text-[#8094ae] line-clamp-1">{task.description}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[#8094ae]">
                    {dev && (
                      <span className="flex items-center gap-1">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0971fe] text-white text-[9px] font-bold">
                          {dev.name?.[0]?.toUpperCase()}
                        </span>
                        {dev.name}
                      </span>
                    )}
                    {proj && <span>· {proj.projectName || proj.projectType}</span>}
                    {task.dueDate && (
                      <span className={overdue ? "text-red-500 font-medium" : ""}>
                        · Due {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {isDel ? (
                    <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                      <span className="text-xs text-red-600">Delete?</span>
                      <button onClick={() => handleDelete(task.id)}
                        className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-red-600">Yes</button>
                      <button onClick={() => setDeleteId(null)}
                        className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-500 hover:bg-red-100">No</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => openEdit(task)}
                        className="rounded p-1.5 text-[#8094ae] hover:bg-[#f0f6ff] hover:text-[#0971fe] transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(task.id)}
                        className="rounded p-1.5 text-[#8094ae] hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
}
