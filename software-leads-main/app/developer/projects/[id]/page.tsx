"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, Mail, FolderKanban, CalendarDays, Tag,
  CheckSquare, Code2, Clock, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { developerApi } from "@/lib/developerApi";
import { useDeveloperAuth } from "@/contexts/DeveloperAuthContext";

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
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_CFG: Record<string, { dot: string; text: string; bg: string }> = {
  ACTIVE:    { dot: "bg-green-400",  text: "text-green-700",  bg: "bg-green-50 border-green-200"   },
  CONVERTED: { dot: "bg-teal-400",   text: "text-teal-700",   bg: "bg-teal-50 border-teal-200"     },
  COMPLETED: { dot: "bg-blue-400",   text: "text-blue-700",   bg: "bg-blue-50 border-blue-200"     },
  ON_HOLD:   { dot: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  CANCELLED: { dot: "bg-red-400",    text: "text-red-600",    bg: "bg-red-50 border-red-200"       },
};
const STATUS_LABELS: Record<string, string> = {
  CONVERTED: "Active", ACTIVE: "Active", COMPLETED: "Completed",
  ON_HOLD: "On Hold", CANCELLED: "Cancelled",
};
const SERVICE_TYPE_LABELS: Record<string, string> = {
  WEB_DEVELOPMENT:     "Web Development",
  APP_DEVELOPMENT:     "App Development",
  APP_WEB_DEVELOPMENT: "App + Web Development",
  DIGITAL_MARKETING:   "Digital Marketing",
  DESIGN_SERVICES:     "Design Services",
  OTHERS:              "Others",
};
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

export default function DeveloperProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { developer } = useDeveloperAuth();

  const [project,    setProject]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await developerApi.projects.get(id);
      setProject(data ?? null);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (id) load(); }, [id]);

  async function handleUpdateStatus(taskId: string, status: string) {
    setUpdatingId(taskId);
    try {
      await developerApi.tasks.updateStatus(taskId, status);
      showToast(`Task updated to "${status}"`);
      await load();
    } catch {
      showToast("Failed to update task.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
    </div>
  );
  if (!project) return (
    <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">
      Project not found or not assigned to you.
    </div>
  );

  const statusKey = String(project.status ?? "").toUpperCase();
  const cfg       = STATUS_CFG[statusKey] ?? STATUS_CFG["ACTIVE"];
  const developers: any[] = Array.isArray(project.developers) ? project.developers : [];
  const myTasks:    any[] = Array.isArray(project.myTasks)    ? project.myTasks    : [];

  const overview = project.overview ?? {
    web:   project.webOverview   ?? [],
    app:   project.appOverview   ?? [],
    admin: project.adminOverview ?? [],
  };
  const hasOverview = overview.web?.length || overview.app?.length || overview.admin?.length;

  return (
    <div className="space-y-6">

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/developer/projects"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-[#1a2035]">{project.projectName}</h1>
            <div className="mt-1 flex items-center gap-2">
              {project.serviceType && (
                <span className="text-xs text-[#8094ae]">{SERVICE_TYPE_LABELS[project.serviceType] ?? project.serviceType}</span>
              )}
              {project.serviceType && <span className="text-[#8094ae]">·</span>}
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {STATUS_LABELS[statusKey] ?? project.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-[#e5e9f2] bg-white px-5 py-4 shadow-sm">
        {project.clientName && (
          <div className="flex items-center gap-2 text-sm text-[#8094ae]">
            <User className="h-4 w-4 shrink-0" />
            <span className="font-medium text-[#1a2035]">{project.clientName}</span>
          </div>
        )}
        {project.deadline && (() => {
          const due = new Date(project.deadline); due.setHours(0,0,0,0);
          const today = new Date(); today.setHours(0,0,0,0);
          const overdue = due < today && statusKey !== "COMPLETED";
          return (
            <div className={`flex items-center gap-2 text-sm font-medium ${overdue ? "text-red-600" : "text-green-600"}`}>
              <CalendarDays className="h-4 w-4 shrink-0" />
              {formatDate(project.deadline)}
              {overdue && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                  Overdue
                </span>
              )}
            </div>
          );
        })()}
        {project.createdAt && (
          <div className="flex items-center gap-2 text-sm text-[#8094ae]">
            <Clock className="h-4 w-4 shrink-0" />Since {formatDate(project.createdAt)}
          </div>
        )}
      </div>

      {/* Description */}
      {(project.description || project.projectDescription) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-base">Project Description</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#1a2035] leading-relaxed">
              {project.description ?? project.projectDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Project Modules */}
      {hasOverview && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-base">Project Modules</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {([
                { items: overview.web,   label: "Web",   dot: "bg-blue-400",    bg: "bg-blue-50 border-blue-100" },
                { items: overview.app,   label: "App",   dot: "bg-emerald-400", bg: "bg-emerald-50 border-emerald-100" },
                { items: overview.admin, label: "Admin", dot: "bg-purple-400",  bg: "bg-purple-50 border-purple-100" },
              ] as const).map((cat) =>
                cat.items && cat.items.length > 0 ? (
                  <div key={cat.label} className={`rounded-xl border px-4 py-3 space-y-1.5 ${cat.bg}`}>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#8094ae]">
                      <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} />{cat.label}
                    </span>
                    {cat.items.map((pt: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-[#1a2035]">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />{pt}
                      </div>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {project.timelines && project.timelines.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-base">Project Timeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.timelines.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 px-4 py-2.5">
                <span className="text-sm text-orange-700">{t.description || "—"}</span>
                <span className="text-sm font-semibold text-orange-700">{t.workingDays || 0} days</span>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <span className="text-xs text-[#8094ae]">
                Total: {project.timelines.reduce((s: number, t: any) => s + Number(t.workingDays || 0), 0)} working days
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features (names only, no prices) */}
      {project.featureItems && project.featureItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-base">Project Features</CardTitle>
              <span className="rounded-full bg-teal-600/10 px-2 py-0.5 text-xs font-medium text-teal-600">
                {project.featureItems.length}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {project.featureItems.map((f: any) => (
                <span key={f.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e9f2] bg-[#f9fafc] px-3 py-1.5 text-sm text-gray-700">
                  <CheckSquare className="h-3 w-3 text-teal-600" />{f.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-teal-600" />
            <CardTitle className="text-base">Team ({developers.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {developers.length === 0 ? (
            <p className="text-sm text-[#8094ae]">No team members assigned.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {developers.map((dev: any, i: number) => {
                const isMe = developer && dev.id === developer.id;
                return (
                  <div key={dev.id ?? i}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isMe ? "border-teal-200 bg-teal-50" : "border-[#e5e9f2] bg-[#f9fafc]"}`}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(dev.name || "D")}`}>
                      {initials(dev.name || "D")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-gray-800">{dev.name || "Developer"}</p>
                        {isMe && (
                          <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold text-white">You</span>
                        )}
                      </div>
                      {dev.role && <p className="truncate text-xs text-[#8094ae]">{dev.role}</p>}
                      {dev.experience && <p className="truncate text-xs text-[#8094ae]">{dev.experience}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Tasks on this project */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-teal-600" />
            <CardTitle className="text-base">My Tasks</CardTitle>
            {myTasks.length > 0 && (
              <span className="rounded-full bg-teal-600/10 px-2 py-0.5 text-xs font-medium text-teal-600">
                {myTasks.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {myTasks.length === 0 ? (
            <p className="text-sm text-[#8094ae]">No tasks assigned on this project yet.</p>
          ) : myTasks.map((t: any) => {
            const overdue = t.dueDate && t.status !== "Done" && new Date(t.dueDate) < new Date();
            return (
              <div key={t.id} className="rounded-xl border border-[#e5e9f2] bg-[#f9fafc] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1a2035]">{t.title}</p>
                    {t.description && (
                      <p className="mt-0.5 truncate text-xs text-[#8094ae]">{t.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {t.dueDate && (
                        <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-[#8094ae]"}`}>
                          Due: {formatDate(t.dueDate)}
                          {overdue && (
                            <span className="ml-1.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">
                              Overdue
                            </span>
                          )}
                        </span>
                      )}
                      {t.priority && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                          {t.priority}
                        </span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${TASK_STATUS_COLORS[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                  <select
                    value={t.status}
                    disabled={updatingId === t.id}
                    onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                    className="h-8 shrink-0 rounded-lg border border-[#e5e9f2] bg-white px-2 text-xs text-gray-600 focus:border-teal-500 focus:outline-none disabled:opacity-50"
                  >
                    {["Todo", "In Progress", "In Review", "Done"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

    </div>
  );
}
