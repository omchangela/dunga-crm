"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, FolderOpen, Wallet, LayoutDashboard, DollarSign, TrendingUp, AlertCircle, ArrowUpRight } from "lucide-react";
import { financeApi, fetchFinanceProjects } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

const PROJ_STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  CONVERTED: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  REJECTED:  "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  ACTIVE:    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  COMPLETED: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  ON_HOLD:   "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  CANCELLED: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
};

function projStatusLabel(s: string) {
  return s === "CONVERTED" ? "ACTIVE" : s;
}

export default function FinancesPage() {
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchFinanceData() {
      try {
        const [summaryData, projectsData] = await Promise.all([
          financeApi.summary(),
          fetchFinanceProjects(),
        ]);
        setFinanceSummary(summaryData.summary);
        setProjects(projectsData || []);
      } catch (error) {
        console.error("Failed fetching live financial telemetry streams:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFinanceData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden p-6">
          <ListSkeleton rows={5} />
        </div>
      </div>
    );
  }

  const pipelineBudget = financeSummary?.totalPipelineBudget ?? 0;
  const totalReceived = financeSummary?.totalReceived ?? 0;
  const outstandingBalance = financeSummary?.outstandingBalance ?? 0;
  const liquidationFactor = pipelineBudget > 0 ? Math.round((totalReceived / pipelineBudget) * 100) : 0;

  return (
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
              <Wallet className="h-3.5 w-3.5 text-blue-300" />
              Financial Ledger & Revenue
              <span className="opacity-40">•</span>
              {projects.length} Active Accounts
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Financial Overview
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Real-time payment collections, outstanding balances, and project revenue tracking.
            </p>
          </div>
        </div>
      </section>

      {/* ══ TOP METRIC KPI CARDS ══ */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Pipeline Budget",
            value: formatCurrency(pipelineBudget),
            sub: "Aggregate Contractual Revenue",
            icon: DollarSign,
            color: "from-blue-600 to-indigo-600",
          },
          {
            label: "Revenue Collected",
            value: formatCurrency(totalReceived),
            sub: `${liquidationFactor}% Liquidation Achieved`,
            icon: TrendingUp,
            color: "from-emerald-600 to-teal-600",
          },
          {
            label: "Outstanding Balance",
            value: formatCurrency(outstandingBalance),
            sub: "Pending Collection Balance",
            icon: AlertCircle,
            color: "from-amber-600 to-orange-600",
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

      {/* ══ PROJECTS FINANCIAL CONTAINER ══ */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Project Financial Ledgers
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Payment schedules and balance breakdown by project
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Wallet className="h-12 w-12 stroke-[1.5] text-slate-300" />
            <p className="text-xs font-bold text-slate-500">No active financial ledgers found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold">
                  <th className="py-3.5 px-6">Project Name</th>
                  <th className="py-3.5 px-6">Customer / Client</th>
                  <th className="py-3.5 px-6 text-right">Payment Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map((proj) => {
                  const statusLabel  = projStatusLabel(proj.status);
                  const overdue = proj.deadline
                    ? new Date(proj.deadline) < new Date() && proj.status !== "COMPLETED"
                    : false;
                  const customerId   = proj.customerId ?? proj.customer?.id ?? null;
                  const customerName = proj.customer?.fullName ?? proj.clientName ?? proj.customerName ?? null;

                  return (
                    <tr key={proj.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                            <FolderOpen className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{proj.projectName || "Unnamed Project"}</p>
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${PROJ_STATUS_COLOR[statusLabel] ?? "bg-slate-100 text-slate-600"}`}>
                                {statusLabel}
                              </span>
                              {overdue && (
                                <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-rose-600 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                                  Overdue
                                </span>
                              )}
                            </div>
                            {proj.deadline && (
                              <p className={`text-xs font-semibold ${overdue ? "text-rose-600" : "text-slate-500"}`}>
                                Target: {new Date(proj.deadline).toLocaleDateString("en-IN")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {customerId ? (
                          <Link href={`/customers/${customerId}`}
                            className="text-xs font-bold text-slate-900 dark:text-white hover:text-blue-600 hover:underline">
                            {customerName || "View customer"}
                          </Link>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">{customerName || "—"}</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <Link href={`/finances/${proj.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-blue-400">
                          View Ledger <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}