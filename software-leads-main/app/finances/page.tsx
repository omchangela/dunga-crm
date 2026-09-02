"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, FolderOpen, Wallet, LayoutDashboard } from "lucide-react";
import { financeApi, fetchFinanceProjects } from "@/lib/api";
import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

const PROJ_STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700 border border-amber-200",
  CONVERTED: "bg-blue-100 text-blue-700 border border-blue-200",
  REJECTED:  "bg-rose-100 text-rose-700 border border-rose-200",
  ACTIVE:    "bg-blue-100 text-blue-700 border border-blue-200",
  COMPLETED: "bg-green-100 text-green-700 border border-green-200",
  ON_HOLD:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
  CANCELLED: "bg-red-100 text-red-700 border border-red-200",
};

// A converted project is in its delivery phase — show it as "Active".
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
      <div className="space-y-8 p-1">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ListSkeleton rows={5} />
        </div>
      </div>
    );
  }

  const pipelineBudget = financeSummary?.totalPipelineBudget ?? 0;
  const totalReceived = financeSummary?.totalReceived ?? 0;
  const outstandingBalance = financeSummary?.outstandingBalance ?? 0;

  return (
    <div className="space-y-8 p-1">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Financial Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">Real-time payment history and collection metrics across operations</p>
        </div>
      </div>

      {/* Summary Analytics Grid */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Pipeline Budget</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">₹{(pipelineBudget / 100000).toFixed(2)}L</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <LayoutDashboard className="h-3.5 w-3.5 text-slate-400" />
            <span>Aggregate contractual pipeline</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm transition-all hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Revenue Received</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-800">₹{(totalReceived / 100000).toFixed(2)}L</p>
          <p className="mt-2 text-xs font-medium text-emerald-600">
            {pipelineBudget > 0 ? Math.round((totalReceived / pipelineBudget) * 100) : 0}% Liquidation Factor Achieved
          </p>
        </div>

        <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-6 shadow-sm transition-all hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Outstanding Receivables</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-orange-700">₹{(outstandingBalance / 100000).toFixed(2)}L</p>
          <p className="mt-2 text-xs font-medium text-orange-500">Remaining to collect natively</p>
        </div>
      </div>

      {/* Projects list Management */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800">Collection Accounts by Functional Project</h3>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Wallet className="h-12 w-12 stroke-[1.5] opacity-40" />
            <p className="text-sm font-medium">No projects currently instantiated inside pipeline data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3">Project</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3 text-right">Payment History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((proj) => {
                  const statusLabel  = projStatusLabel(proj.status);
                  const overdue = proj.deadline
                    ? new Date(proj.deadline) < new Date() && proj.status !== "COMPLETED"
                    : false;
                  const customerId   = proj.customerId ?? proj.customer?.id ?? null;
                  const customerName = proj.customer?.fullName ?? proj.clientName ?? proj.customerName ?? null;

                  return (
                    <tr key={proj.id} className="group hover:bg-slate-50/80 transition-colors">
                      {/* Project */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <FolderOpen className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">{proj.projectName || "Unnamed Project"}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${PROJ_STATUS_COLOR[statusLabel] ?? "bg-slate-100 text-slate-600"}`}>
                                {statusLabel}
                              </span>
                              {overdue && (
                                <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600 tracking-wide">
                                  Overdue
                                </span>
                              )}
                            </div>
                            {proj.deadline && (
                              <p className={`text-xs font-medium ${overdue ? "text-rose-500 font-semibold" : "text-slate-500"}`}>
                                Target: {new Date(proj.deadline).toLocaleDateString("en-IN")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Customer → profile */}
                      <td className="px-6 py-4">
                        {customerId ? (
                          <Link href={`/customers/${customerId}`}
                            className="text-sm font-semibold text-slate-800 hover:text-blue-600 hover:underline">
                            {customerName || "View customer"}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">{customerName || "—"}</span>
                        )}
                      </td>

                      {/* Payment History → ledger view */}
                      <td className="px-6 py-4 text-right">
                        <Link href={`/finances/${proj.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                          Open View <ChevronRight className="h-3.5 w-3.5" />
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