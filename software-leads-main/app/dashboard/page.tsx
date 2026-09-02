"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus, UserPlus, Users, TrendingUp,
  ArrowRight, Clock, Bell, FolderKanban, Code2, Calendar,
} from "lucide-react";
import {
  fetchLeads, fetchCustomers, fetchAllProjects, fetchDevelopers, fetchReminders,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";

// A converted project is in its delivery phase — show it as "Active".
function projStatusLabel(s: string) {
  return s === "Converted" ? "Active" : s;
}

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

const TYPE_COLORS = [
  "#3B82F6","#8B5CF6","#10B981","#F59E0B",
  "#EF4444","#EC4899","#14B8A6","#6366F1",
];

const STATUS_CFG: Record<string, { dot: string; text: string; bar: string; label: string }> = {
  PENDING:   { dot: "bg-yellow-400", text: "text-yellow-600", bar: "#FACC15", label: "Pending"   },
  REJECTED:  { dot: "bg-red-400",    text: "text-red-500",    bar: "#F87171", label: "Rejected"  },
  CONVERTED: { dot: "bg-purple-400", text: "text-purple-600", bar: "#C084FC", label: "Converted" },
  FOLLOWUP:  { dot: "bg-blue-400",   text: "text-blue-600",   bar: "#60A5FA", label: "Follow Up" },
};

const PROJECT_STATUS_CFG: Record<string, { dot: string; text: string }> = {
  Active:    { dot: "bg-green-400",  text: "text-green-700"  },
  Completed: { dot: "bg-blue-400",   text: "text-blue-700"   },
  "On Hold": { dot: "bg-yellow-400", text: "text-yellow-700" },
  Cancelled: { dot: "bg-red-400",    text: "text-red-600"    },
};

// function greeting() {
//   const h = new Date().getHours();
//   if (h >= 5  && h < 12) return "Good morning 🌤";
//   if (h >= 12 && h < 17) return "Good afternoon ☀️";
//   if (h >= 17 && h < 21) return "Good evening 🌙";
//   return "Good night 🌙";
// }

function fmtDateTime(iso: string) {
  const dt = new Date(iso);
  return dt.toLocaleString("en-IN", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [leads,      setLeads]      = useState<any[]>([]);
  const [customers,  setCustomers]  = useState<any[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [projects,   setProjects]   = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [reminders,  setReminders]  = useState<any[]>([]);
  const [pendingCountApi, setPendingCountApi] = useState(0);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [leadsRes, custRes, projRes, devs, remRes] = await Promise.all([
          fetchLeads({ status: "ALL", limit: "500" }),
          fetchCustomers({ limit: "500" }),
          fetchAllProjects({ status: "CONVERTED,ACTIVE,COMPLETED,ON_HOLD,CANCELLED", limit: "500" }),
          fetchDevelopers(),
          fetchReminders("ALL"),
        ]);
        setLeads(leadsRes.leads);
        setCustomers(custRes.customers);
        setCustomersTotal(custRes.pagination?.total ?? custRes.customers.length);
        setProjects(projRes.projects);
        setDevelopers(devs);
        setReminders(remRes.reminders);
        setPendingCountApi(remRes.pendingCount);
      } catch {
        /* leave empties — UI shows zero states */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalConverted = leads.filter((l) => l.status === "CONVERTED").length;
  const pendingCount   = pendingCountApi || reminders.filter((r) => r.status === "PENDING").length;
  const convRate       = leads.length ? Math.round((totalConverted / leads.length) * 100) : 0;

  const pipeline = (["PENDING","FOLLOWUP","CONVERTED","REJECTED"] as const)
    .map((key) => ({ ...STATUS_CFG[key], key, count: leads.filter((l) => l.status === key).length }))
    .filter(({ count }) => count > 0);

  const typeMap: Record<string, number> = {};
  leads.forEach((l) => { if (l.projectType) typeMap[l.projectType] = (typeMap[l.projectType] ?? 0) + 1; });
  const projectTypes = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count, pct: leads.length ? Math.round((count / leads.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const pendingReminders = reminders
    .filter((r) => r.status === "PENDING")
    .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime())
    .slice(0, 5);

  const today = new Date();
  const upcomingDeadlines = [...projects]
    .filter((p) => p.deadline && p.status !== "Completed" && p.status !== "Cancelled")
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-2xl lg:col-span-3" />
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-60 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1d4e] via-[#0e357a] to-[#0971fe] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* <p className="text-sm font-medium text-blue-200">{greeting()}</p> */}
            <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-blue-200/75">
              {totalConverted} leads converted &nbsp;·&nbsp; {pendingCount} reminder{pendingCount !== 1 ? "s" : ""} pending
            </p>
          </div>
          <Link href="/leads/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0971fe] shadow-lg transition-transform hover:scale-105">
            <Plus className="h-4 w-4" />Add Lead
          </Link>
        </div>

        {/* Stat tiles */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { label: "Total Leads",    value: leads.length,      icon: UserPlus,     accent: "text-sky-300",     href: "/leads"      },
            { label: "Customers",      value: customersTotal,    icon: Users,        accent: "text-emerald-300", href: "/customers"  },
            { label: "Projects",       value: projects.length,   icon: FolderKanban, accent: "text-purple-300",  href: "/projects"   },
            { label: "Developers",     value: developers.length, icon: Code2,        accent: "text-orange-300",  href: "/developers" },
          ] as const).map(({ label, value, icon: Icon, accent, href }) => (
            <Link key={label} href={href}
              className="group rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition-all hover:bg-white/20">
              <div className="flex items-start justify-between">
                <p className="text-xs text-blue-100/70">{label}</p>
                <Icon className={`h-4 w-4 ${accent}`} />
              </div>
              <p className="mt-3 text-3xl font-bold text-white">{value}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ MIDDLE ROW ══ */}
      <div className="grid gap-5 lg:grid-cols-5">

        {/* Lead Pipeline */}
        <div className="flex flex-col rounded-2xl border border-[#e5e9f2] bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#1a2035]">Lead Pipeline</h2>
              <p className="mt-0.5 text-xs text-[#8094ae]">Status breakdown across {leads.length} total leads</p>
            </div>
            <Link href="/leads" className="flex items-center gap-1 text-xs font-medium text-[#0971fe] hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex-1 space-y-5 p-5">
            {pipeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <UserPlus className="mb-2 h-8 w-8 text-[#8094ae]" />
                <p className="text-sm text-[#8094ae]">No leads yet. Add your first lead.</p>
              </div>
            ) : pipeline.map(({ key, label, dot, text, bar, count }) => {
              const pct = leads.length ? Math.round((count / leads.length) * 100) : 0;
              return (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      <span className={`text-sm font-medium ${text}`}>{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#8094ae]">{pct}%</span>
                      <span className="w-6 text-right text-sm font-bold text-[#1a2035]">{count}</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f5f6fa]">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: bar }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 rounded-b-2xl border-t border-[#e5e9f2] bg-[#f9fafc] px-5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0971fe]/10">
              <TrendingUp className="h-4 w-4 text-[#0971fe]" />
            </div>
            <div>
              <p className="text-xs text-[#8094ae]">Conversion rate</p>
              <p className="text-sm font-bold text-[#1a2035]">{convRate}% of leads converted</p>
            </div>
          </div>
        </div>

        {/* Project Types */}
        <div className="flex flex-col rounded-2xl border border-[#e5e9f2] bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-[#e5e9f2] px-5 py-4">
            <h2 className="text-base font-semibold text-[#1a2035]">Project Types</h2>
            <p className="mt-0.5 text-xs text-[#8094ae]">Distribution across all leads</p>
          </div>
          <div className="flex-1 space-y-4 p-5">
            {projectTypes.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#8094ae]">No data yet.</p>
            ) : projectTypes.map(({ type, count, pct }, i) => (
              <div key={type}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                    <span className="truncate text-xs text-gray-600">{type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#8094ae]">{pct}%</span>
                    <span className="font-semibold text-[#1a2035]">{count}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f5f6fa]">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-b-2xl border-t border-[#e5e9f2] bg-[#f9fafc] px-5 py-3">
            <p className="text-xs text-[#8094ae]">{projectTypes.length} type{projectTypes.length !== 1 ? "s" : ""} across {leads.length} leads</p>
          </div>
        </div>
      </div>

      {/* ══ BOTTOM ROW ══ */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Recent Leads */}
        <div className="overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#1a2035]">Recent Leads</h2>
              <p className="mt-0.5 text-xs text-[#8094ae]">Latest 5 by date</p>
            </div>
            <Link href="/leads" className="flex items-center gap-1 text-xs font-medium text-[#0971fe] hover:underline">
              All leads <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#f5f6fa]">
            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <UserPlus className="mb-2 h-8 w-8 text-[#8094ae]" />
                <p className="text-sm text-[#8094ae]">No leads yet.</p>
              </div>
            ) : recentLeads.map((lead) => {
              const cfg = STATUS_CFG[lead.status] ?? STATUS_CFG["PENDING"];
              return (
                <Link key={lead.id} href={`/leads/${lead.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#f9fafc]">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(lead.fullName)}`}>
                    {initials(lead.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1a2035]">{lead.fullName}</p>
                    <p className="truncate text-xs text-[#8094ae]">{lead.projectType || "—"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      <span className={`text-xs ${cfg.text}`}>{cfg.label}</span>
                    </div>
                  </div>
                  <p className="hidden w-20 shrink-0 text-right text-xs text-[#8094ae] sm:block">
                    {formatDate(lead.createdAt)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Pending Reminders */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#1a2035]">Reminders</h2>
              <p className="mt-0.5 text-xs text-[#8094ae]">{pendingCount} pending</p>
            </div>
            <Link href="/reminders" className="text-xs font-medium text-[#0971fe] hover:underline">View all</Link>
          </div>
          <div className="flex-1 divide-y divide-[#f5f6fa]">
            {pendingReminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Bell className="mb-2 h-8 w-8 text-[#8094ae]" />
                <p className="text-sm text-[#8094ae]">No pending reminders.</p>
              </div>
            ) : pendingReminders.map((r) => {
              const lead    = r.lead;
              const overdue = new Date(r.reminderAt) < new Date();
              return (
                <Link key={r.id} href={lead ? `/leads/${lead.id}` : "/reminders"}
                  className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-[#f9fafc]">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${overdue ? "bg-red-400" : "bg-yellow-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1a2035]">
                      {lead?.fullName ?? "Unknown lead"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#8094ae]">
                      <Clock className="h-3 w-3 shrink-0" />
                      {fmtDateTime(r.reminderAt)}
                    </p>
                    {overdue && (
                      <span className="mt-0.5 inline-block rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Overdue</span>
                    )}
                    {r.note && r.note !== "Follow up" && (
                      <p className="mt-0.5 truncate text-xs text-[#b0bac9]">{r.note}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="border-t border-[#e5e9f2] p-4">
            <Link href="/reminders"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e9f2] py-2 text-sm font-medium text-[#8094ae] transition-colors hover:border-[#0971fe] hover:text-[#0971fe]">
              <Bell className="h-4 w-4" />Manage reminders
            </Link>
          </div>
        </div>
      </div>

      {/* ══ ROW 3: Recent Projects + Upcoming Deadlines ══ */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Recent Projects */}
        <div className="overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#1a2035]">Recent Projects</h2>
              <p className="mt-0.5 text-xs text-[#8094ae]">Latest 4 converted projects</p>
            </div>
            <Link href="/projects" className="flex items-center gap-1 text-xs font-medium text-[#0971fe] hover:underline">
              All projects <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#f5f6fa]">
            {recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <FolderKanban className="mb-2 h-8 w-8 text-[#8094ae]" />
                <p className="text-sm text-[#8094ae]">No projects yet.</p>
                <p className="mt-1 text-xs text-[#8094ae]">Convert a lead to create a project.</p>
              </div>
            ) : recentProjects.map((p) => {
              const pStatus = projStatusLabel(p.status);
              const pcfg = PROJECT_STATUS_CFG[pStatus] ?? PROJECT_STATUS_CFG["Active"];
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#f9fafc]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0f6ff]">
                    <FolderKanban className="h-4 w-4 text-[#0971fe]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1a2035]">{p.projectName}</p>
                    <p className="truncate text-xs text-[#8094ae]">{p.clientName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#1a2035]">
                      {p.budget ? formatCurrency(p.budget) : "—"}
                    </p>
                    <div className="mt-0.5 flex items-center justify-end gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${pcfg.dot}`} />
                      <span className={`text-xs ${pcfg.text}`}>{pStatus}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#1a2035]">Upcoming Deadlines</h2>
              <p className="mt-0.5 text-xs text-[#8094ae]">Projects with scheduled deadlines</p>
            </div>
            <Link href="/projects" className="flex items-center gap-1 text-xs font-medium text-[#0971fe] hover:underline">
              All projects <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#f5f6fa]">
            {upcomingDeadlines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Calendar className="mb-2 h-8 w-8 text-[#8094ae]" />
                <p className="text-sm text-[#8094ae]">No upcoming deadlines.</p>
                <p className="mt-1 text-xs text-[#8094ae]">Set a deadline on a project to see it here.</p>
              </div>
            ) : upcomingDeadlines.map((p) => {
              const daysLeft = Math.ceil((new Date(p.deadline).getTime() - today.getTime()) / 86400000);
              const isOverdue = daysLeft < 0;
              const isSoon    = daysLeft >= 0 && daysLeft <= 3;
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#f9fafc]">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isOverdue ? "bg-red-50" : isSoon ? "bg-orange-50" : "bg-[#f0f6ff]"
                  }`}>
                    <Calendar className={`h-5 w-5 ${isOverdue ? "text-red-500" : isSoon ? "text-orange-500" : "text-[#0971fe]"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1a2035]">{p.projectName}</p>
                    <p className="truncate text-xs text-[#8094ae]">{p.clientName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-semibold ${isOverdue ? "text-red-600" : isSoon ? "text-orange-600" : "text-[#1a2035]"}`}>
                      {isOverdue
                        ? `${Math.abs(daysLeft)}d overdue`
                        : daysLeft === 0
                        ? "Due today"
                        : `${daysLeft}d left`}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8094ae]">
                      {new Date(p.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
