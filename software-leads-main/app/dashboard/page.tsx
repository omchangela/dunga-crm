"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  UserPlus,
  Users,
  TrendingUp,
  ArrowRight,
  Clock,
  Bell,
  FolderKanban,
  Code2,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  DollarSign,
  Layers,
  Check,
  ChevronRight,
  Activity,
  RefreshCw,
  PhoneCall,
} from "lucide-react";
import {
  fetchLeads,
  fetchCustomers,
  fetchAllProjects,
  fetchDevelopers,
  fetchReminders,
  remindersApi,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";

// ── Helpers & Styling Constants ─────────────────────────────────────────────

function projStatusLabel(s: string) {
  return s === "Converted" ? "Active" : s;
}

const AVATAR_COLORS = [
  "bg-gradient-to-br from-indigo-600 to-blue-700",
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
  if (!name) return "LD";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const TYPE_COLORS = [
  { bar: "from-blue-600 to-indigo-500", dot: "bg-blue-600", text: "text-blue-600" },
  { bar: "from-purple-600 to-pink-500", dot: "bg-purple-600", text: "text-purple-600" },
  { bar: "from-emerald-600 to-teal-500", dot: "bg-emerald-600", text: "text-emerald-600" },
  { bar: "from-amber-600 to-orange-500", dot: "bg-amber-600", text: "text-amber-600" },
  { bar: "from-rose-600 to-red-500", dot: "bg-rose-600", text: "text-rose-600" },
  { bar: "from-indigo-600 to-cyan-500", dot: "bg-indigo-600", text: "text-indigo-600" },
];

const STATUS_CFG: Record<
  string,
  { dot: string; text: string; bg: string; border: string; barGradient: string; label: string }
> = {
  PENDING: {
    dot: "bg-amber-400 shadow-amber-400/50",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50/80 dark:bg-amber-950/30",
    border: "border-amber-200/80 dark:border-amber-800/40",
    barGradient: "from-amber-400 to-amber-500",
    label: "Pending",
  },
  FOLLOWUP: {
    dot: "bg-blue-400 shadow-blue-400/50",
    text: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50/80 dark:bg-blue-950/30",
    border: "border-blue-200/80 dark:border-blue-800/40",
    barGradient: "from-blue-400 to-indigo-500",
    label: "Follow Up",
  },
  CONVERTED: {
    dot: "bg-emerald-400 shadow-emerald-400/50",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50/80 dark:bg-emerald-950/30",
    border: "border-emerald-200/80 dark:border-emerald-800/40",
    barGradient: "from-emerald-400 to-teal-500",
    label: "Converted",
  },
  REJECTED: {
    dot: "bg-rose-400 shadow-rose-400/50",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50/80 dark:bg-rose-950/30",
    border: "border-rose-200/80 dark:border-rose-800/40",
    barGradient: "from-rose-400 to-red-500",
    label: "Rejected",
  },
};

const PROJECT_STATUS_CFG: Record<string, { dot: string; text: string; bg: string }> = {
  Active: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  Completed: { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50" },
  "On Hold": { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  Cancelled: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" },
};

function fmtDateTime(iso: string) {
  try {
    const dt = new Date(iso);
    return dt.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// ── Dashboard Component ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [pendingCountApi, setPendingCountApi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"reminders" | "leads" | "projects">("reminders");
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [leadsRes, custRes, projRes, devs, remRes] = await Promise.all([
        fetchLeads({ status: "ALL", limit: "500" }),
        fetchCustomers({ limit: "500" }),
        fetchAllProjects({
          status: "CONVERTED,ACTIVE,COMPLETED,ON_HOLD,CANCELLED",
          limit: "500",
        }),
        fetchDevelopers(),
        fetchReminders("ALL"),
      ]);

      setLeads(leadsRes.leads || []);
      setCustomers(custRes.customers || []);
      setCustomersTotal(custRes.pagination?.total ?? (custRes.customers?.length || 0));
      setProjects(projRes.projects || []);
      setDevelopers(devs || []);
      setReminders(remRes.reminders || []);
      setPendingCountApi(remRes.pendingCount || 0);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkReminderDone = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCompletingId(id);
    try {
      await remindersApi.markDone(id);
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "DONE" } : r))
      );
      setPendingCountApi((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark reminder done:", err);
    } finally {
      setCompletingId(null);
    }
  };

  // ── Derived Statistics ───────────────────────────────────────────────────

  const totalConverted = leads.filter((l) => l.status === "CONVERTED").length;
  const pendingCount = pendingCountApi || reminders.filter((r) => r.status === "PENDING").length;
  const convRate = leads.length ? Math.round((totalConverted / leads.length) * 100) : 0;

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);

  const pipelineKeys = ["PENDING", "FOLLOWUP", "CONVERTED", "REJECTED"] as const;
  const pipeline = pipelineKeys.map((key) => {
    const count = leads.filter((l) => l.status === key).length;
    const pct = leads.length ? Math.round((count / leads.length) * 100) : 0;
    return { ...STATUS_CFG[key], key, count, pct };
  });

  const typeMap: Record<string, number> = {};
  leads.forEach((l) => {
    const st = l.serviceType || l.projectType || "General Software";
    typeMap[st] = (typeMap[st] ?? 0) + 1;
  });

  const projectTypes = Object.entries(typeMap)
    .map(([type, count]) => ({
      type,
      count,
      pct: leads.length ? Math.round((count / leads.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const pendingReminders = reminders
    .filter((r) => r.status === "PENDING")
    .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime())
    .slice(0, 6);

  const today = new Date();
  const upcomingDeadlines = [...projects]
    .filter((p) => p.deadline && p.status !== "Completed" && p.status !== "Cancelled")
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  const activeProjects = projects.filter((p) => p.status !== "Completed" && p.status !== "Cancelled");

  // ── Render Loading Skeleton ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-80 rounded-2xl lg:col-span-3" />
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">

      {/* ══ CLEAN PROFESSIONAL HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        {/* Subtle Ambient Lighting */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Real-time overview of leads, client projects, team capacity, and action items.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-blue-300" : ""}`} />
              Refresh
            </button>

            <Link
              href="/leads/new"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add Lead
            </Link>
          </div>
        </div>
      </section>

      {/* ══ TOP METRIC KPI CARDS ══ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Total Leads",
            value: leads.length,
            sub: `${totalConverted} Converted (${convRate}%)`,
            icon: UserPlus,
            color: "from-blue-600 to-indigo-600",
            href: "/leads",
          },
          {
            label: "Active Customers",
            value: customersTotal,
            sub: `${customers.length} Accounts Registered`,
            icon: Users,
            color: "from-emerald-600 to-teal-600",
            href: "/customers",
          },
          {
            label: "Projects",
            value: projects.length,
            sub: `${activeProjects.length} Active Delivery`,
            icon: FolderKanban,
            color: "from-indigo-600 to-purple-600",
            href: "/projects",
          },
          {
            label: "Developers",
            value: developers.length,
            sub: "Engineering Team",
            icon: Code2,
            color: "from-amber-600 to-orange-600",
            href: "/developers",
          },
          {
            label: "Pipeline Value",
            value: formatCurrency(totalBudget),
            sub: "Total Project Budget",
            icon: DollarSign,
            color: "from-rose-600 to-pink-600",
            href: "/projects",
          },
        ].map(({ label, value, sub, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
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
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">{sub}</span>
                <span className="flex items-center gap-0.5 font-bold text-blue-600 group-hover:translate-x-0.5 transition">
                  View <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-600/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </section>

      {/* ══ ANALYTICS & PIPELINE BREAKDOWN ══ */}
      <section className="grid gap-6 lg:grid-cols-5">

        {/* Lead Pipeline Analytics */}
        <div className="flex flex-col rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Lead Pipeline
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  {leads.length} Total
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Status breakdown across all leads
              </p>
            </div>
            <Link
              href="/leads"
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex-1 space-y-4 p-6">
            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UserPlus className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No leads yet</p>
                <Link
                  href="/leads/new"
                  className="mt-3 text-xs font-bold text-blue-600 underline hover:text-blue-700"
                >
                  Add your first lead
                </Link>
              </div>
            ) : (
              pipeline.map(({ key, label, dot, text, bg, border, barGradient, count, pct }) => (
                <div
                  key={key}
                  className={`rounded-2xl border ${border} ${bg} p-4 transition hover:shadow-md`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-3 w-3 rounded-full ${dot} ring-4 ring-white dark:ring-slate-900`} />
                      <span className={`text-sm font-bold ${text}`}>{label}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-white/80 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {pct}%
                      </span>
                      <span className="w-8 text-right text-base font-extrabold text-slate-900 dark:text-white">
                        {count}
                      </span>
                    </div>
                  </div>

                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between rounded-b-3xl border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Conversion Rate</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {totalConverted} of {leads.length} leads converted
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {convRate}% Converted
              </span>
            </div>
          </div>
        </div>

        {/* Service Distribution */}
        <div className="flex flex-col rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Project Types
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Distribution across all leads
            </p>
          </div>

          <div className="flex-1 space-y-4 p-6">
            {projectTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-400">No project type breakdown yet</p>
              </div>
            ) : (
              projectTypes.map(({ type, count, pct }, i) => {
                const colorScheme = TYPE_COLORS[i % TYPE_COLORS.length];
                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2.5 w-2.5 rounded-full ${colorScheme.dot}`} />
                        <span className="truncate font-bold text-slate-800 dark:text-slate-200">
                          {type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400 font-semibold">{pct}%</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">{count}</span>
                      </div>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${colorScheme.bar} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-b-3xl border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-xs font-semibold text-slate-500">
              Top Type:{" "}
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                {projectTypes[0]?.type || "N/A"}
              </span>
              {projectTypes[0] ? ` (${projectTypes[0].pct}%)` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* ══ RECENT FEEDS & ACTION ITEMS ══ */}
      <section className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Workspace Tab Header */}
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Activity & Reminders
            </h2>
            <p className="text-xs text-slate-500">
              Recent leads, pending reminders, and project deadlines
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setActiveTab("reminders")}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "reminders"
                  ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              Reminders ({pendingCount})
            </button>

            <button
              onClick={() => setActiveTab("leads")}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "leads"
                  ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Recent Leads ({recentLeads.length})
            </button>

            <button
              onClick={() => setActiveTab("projects")}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "projects"
                  ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Deadlines ({upcomingDeadlines.length})
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-6">

          {/* TAB 1: REMINDERS */}
          {activeTab === "reminders" && (
            <div className="space-y-3">
              {pendingReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                    No Pending Reminders
                  </p>
                  <p className="text-xs text-slate-500">All follow-ups are up to date.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingReminders.map((r) => {
                    const lead = r.lead;
                    const overdue = new Date(r.reminderAt) < new Date();
                    const isCompleting = completingId === r.id;

                    return (
                      <div
                        key={r.id}
                        className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all hover:shadow-md ${
                          overdue
                            ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20"
                            : "border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold tracking-wide uppercase ${
                                overdue
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {overdue ? "OVERDUE" : "PENDING"}
                            </span>

                            <button
                              onClick={(e) => handleMarkReminderDone(r.id, e)}
                              disabled={isCompleting}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              title="Mark Done"
                            >
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                              Done
                            </button>
                          </div>

                          <div className="mt-3">
                            <Link
                              href={lead ? `/leads/${lead.id}` : "/reminders"}
                              className="text-sm font-extrabold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                            >
                              {lead?.fullName ?? "Reminder"}
                            </Link>

                            {r.note && (
                              <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                "{r.note}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-semibold">
                          <span>{fmtDateTime(r.reminderAt)}</span>
                          {lead?.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="flex items-center gap-1 font-bold text-blue-600 hover:underline"
                            >
                              <PhoneCall className="h-3 w-3" /> Call
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECENT LEADS */}
          {activeTab === "leads" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-slate-500 dark:border-slate-800 uppercase tracking-wider font-extrabold">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentLeads.map((lead) => {
                    const cfg = STATUS_CFG[lead.status] || STATUS_CFG["PENDING"];
                    return (
                      <tr
                        key={lead.id}
                        className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarBg(
                                lead.fullName
                              )}`}
                            >
                              {initials(lead.fullName)}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                                {lead.fullName}
                              </p>
                              <p className="text-[11px] text-slate-400 font-medium">{lead.phone || lead.email || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                          {lead.serviceType || lead.projectType || "General Software"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-semibold">
                          {formatDate(lead.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            View <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: UPCOMING DEADLINES */}
          {activeTab === "projects" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingDeadlines.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 text-xs font-medium">
                  No upcoming deadlines.
                </div>
              ) : (
                upcomingDeadlines.map((p) => {
                  const daysLeft = Math.ceil(
                    (new Date(p.deadline).getTime() - today.getTime()) / 86400000
                  );
                  const isOverdue = daysLeft < 0;
                  const isSoon = daysLeft >= 0 && daysLeft <= 3;
                  const pStatus = projStatusLabel(p.status);
                  const pcfg = PROJECT_STATUS_CFG[pStatus] || PROJECT_STATUS_CFG["Active"];

                  return (
                    <div
                      key={p.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                              isOverdue
                                ? "bg-rose-100 text-rose-700"
                                : isSoon
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {isOverdue
                              ? `${Math.abs(daysLeft)}d Overdue`
                              : daysLeft === 0
                              ? "Due Today"
                              : `${daysLeft} Days Left`}
                          </span>

                          <span className={`text-xs font-extrabold ${pcfg.text}`}>
                            ● {pStatus}
                          </span>
                        </div>

                        <h3 className="mt-3 text-sm font-black text-slate-900 dark:text-white">
                          {p.projectName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">{p.clientName || "Client"}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {p.budget ? formatCurrency(p.budget) : "—"}
                        </span>
                        <Link
                          href={`/projects/${p.id}`}
                          className="font-bold text-blue-600 hover:underline"
                        >
                          View Project
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

        {/* Footer Link Strip */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-xs text-slate-500 font-medium">
            SoftLeads CRM Modules
          </p>
          <div className="flex gap-4 text-xs font-bold text-blue-600">
            <Link href="/leads" className="hover:underline">Leads</Link>
            <Link href="/projects" className="hover:underline">Projects</Link>
            <Link href="/finances" className="hover:underline">Finances</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
