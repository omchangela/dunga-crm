"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar, TrendingUp, IndianRupee, FileDown, Receipt,
  ChevronRight, Users, FolderOpen, BarChart3, Filter,
  ArrowUpRight, Download
} from "lucide-react";
import { financeApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfViewerModal } from "@/components/shared/pdf-viewer-modal";

const FILTER_PRESETS = [
  { key: "today",     label: "Today" },
  { key: "total",     label: "Total (All Time)" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week",      label: "Last 7 Days" },
  { key: "month",     label: "This Month" },
  { key: "custom",    label: "Custom Range" },
] as const;

const METHOD_COLORS: Record<string, string> = {
  UPI:           "bg-violet-50 text-violet-700 border-violet-200",
  BANK_TRANSFER: "bg-blue-50 text-blue-700 border-blue-200",
  "Bank Transfer": "bg-blue-50 text-blue-700 border-blue-200",
  CASH:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cash:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  CHEQUE:        "bg-amber-50 text-amber-700 border-amber-200",
  Cheque:        "bg-amber-50 text-amber-700 border-amber-200",
  OTHER:         "bg-slate-50 text-slate-600 border-slate-200",
  Other:         "bg-slate-50 text-slate-600 border-slate-200",
};

function formatCurrency(n: number) {
  return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReportsPage() {
  const [activeFilter, setActiveFilter] = useState<string>("today");
  const [fromDate, setFromDate]         = useState("");
  const [toDate, setToDate]             = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalAmount, setTotalAmount]   = useState(0);
  const [count, setCount]               = useState(0);
  const [loading, setLoading]           = useState(false);
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer]       = useState<{ url: string; title: string } | null>(null);
  const [toast, setToast]               = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (activeFilter === "custom") {
        if (!fromDate || !toDate) { setLoading(false); return; }
        params.from = fromDate;
        params.to   = toDate;
      } else {
        params.filter = activeFilter;
      }
      const res = await financeApi.reports(params);
      setTransactions(res?.data?.transactions ?? []);
      setTotalAmount(res?.data?.totalAmount ?? 0);
      setCount(res?.data?.count ?? 0);
    } catch (e: any) {
      console.error("Report fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, fromDate, toDate]);

  useEffect(() => { loadReports(); }, [loadReports]);

  async function handleGenerateReceipt(txnId: string, receiptLabel: string) {
    setReceiptLoading(txnId);
    try {
      const res = await financeApi.generateReceipt(txnId);
      if (res?.data?.pdfUrl) {
        setPdfViewer({ url: res.data.pdfUrl, title: `Receipt ${res.data.receiptNo}` });
      }
    } catch (e: any) {
      showToast("Failed to generate receipt: " + (e?.message || "Unknown error"));
    } finally {
      setReceiptLoading(null);
    }
  }

  // Helper to generate & download CSV file
  function exportTransactionsToCsv(txns: any[], total: number, filterName: string) {
    const headers = [
      "Date",
      "Customer / Project",
      "Customer Name",
      "Project Name",
      "Payment Mode",
      "Ref. / Note",
      "Amount (INR)",
    ];

    const rows = txns.map((txn) => {
      const dateStr = formatDate(txn.paymentDate);
      const customerName = txn.project?.customer?.fullName || "—";
      const projectName = txn.project?.projectName || "—";
      const custProj = customerName !== "—" && projectName !== "—"
        ? `${customerName} / ${projectName}`
        : customerName !== "—" ? customerName : projectName;
      const mode = txn.paymentMethod || "—";
      const refNote = [txn.transactionId, txn.note].filter(Boolean).join(" · ") || "—";
      const amount = Number(txn.amount || 0).toFixed(2);

      return [dateStr, custProj, customerName, projectName, mode, refNote, amount];
    });

    // Append Total row
    rows.push([
      "TOTAL",
      `${txns.length} records`,
      "",
      "",
      "",
      "",
      Number(total || 0).toFixed(2),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((val) => {
            const str = String(val ?? "").replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const sanitizedFilter = filterName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const fileName = `payment_transactions_${sanitizedFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleDownloadCsv() {
    if (transactions.length === 0) {
      showToast("No transactions to download in this period.");
      return;
    }
    exportTransactionsToCsv(transactions, totalAmount, activeLabel);
    showToast(`Downloaded CSV for ${activeLabel}.`);
  }

  async function handleDownloadDirectReport(type: "today" | "total") {
    try {
      showToast(`Preparing ${type === "today" ? "Today's" : "Total (All Time)"} CSV...`);
      const res = await financeApi.reports({ filter: type });
      const txns = res?.data?.transactions ?? [];
      const amt = res?.data?.totalAmount ?? 0;
      if (txns.length === 0) {
        showToast(`No transactions found for ${type === "today" ? "Today" : "Total"}.`);
        return;
      }
      exportTransactionsToCsv(txns, amt, type === "today" ? "Today" : "Total_All_Time");
      showToast(`${type === "today" ? "Today's" : "Total (All Time)"} CSV downloaded successfully.`);
    } catch (e: any) {
      showToast("Failed to download CSV: " + (e?.message || "Unknown error"));
    }
  }

  // Breakdown by payment method
  const methodBreakdown = transactions.reduce((acc: Record<string, number>, txn) => {
    const m = txn.paymentMethod || "Other";
    acc[m] = (acc[m] || 0) + txn.amount;
    return acc;
  }, {});

  const activeLabelObj = FILTER_PRESETS.find(f => f.key === activeFilter);
  const activeLabel = activeFilter === "custom"
    ? (fromDate && toDate ? `${formatDate(fromDate)} – ${formatDate(toDate)}` : "Custom Range")
    : (activeLabelObj?.label ?? activeFilter);

  return (
    <div className="space-y-8 pb-10">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-lg">
            <p className="text-sm font-medium text-rose-800">{toast}</p>
          </div>
        </div>
      )}

      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
              <BarChart3 className="h-3.5 w-3.5 text-blue-300" />
              Payment Reports
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">Payment Reports</h1>
            <p className="mt-1 text-sm text-slate-300">Detailed payment history with date filtering and receipt generation.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadCsv}
              disabled={transactions.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20 disabled:opacity-50 shadow-sm"
              title="Download CSV for current period"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>
            <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md px-5 py-2.5 text-center">
              <p className="text-[10px] font-semibold text-blue-200 uppercase tracking-wide">Period</p>
              <p className="text-sm font-bold text-white">{activeLabel}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Date Filter</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-5">
          {FILTER_PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={[
                "rounded-xl px-4 py-2 text-xs font-bold transition-all border",
                activeFilter === key
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {activeFilter === "custom" && (
          <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 pb-5 pt-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="flex h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="flex h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadReports}
                className="h-9 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </section>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Collected", value: formatCurrency(totalAmount), icon: IndianRupee, color: "from-emerald-600 to-teal-600", sub: `${count} transactions` },
          { label: "Transactions", value: count.toString(), icon: Receipt, color: "from-blue-600 to-indigo-600", sub: activeLabel },
          { label: "Unique Projects", value: [...new Set(transactions.map(t => t.project?.id))].length.toString(), icon: FolderOpen, color: "from-violet-600 to-purple-600", sub: "Projects paid in period" },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-md transition group-hover:scale-110`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-600/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </section>

      {/* Method Breakdown */}
      {Object.keys(methodBreakdown).length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-bold text-slate-800">Payment Method Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">Total by payment mode for selected period</p>
          </div>
          <div className="flex flex-wrap gap-4 p-6">
            {Object.entries(methodBreakdown).map(([method, amount]) => (
              <div key={method} className={`rounded-xl border px-5 py-3 ${METHOD_COLORS[method] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{method}</p>
                <p className="text-lg font-black mt-1">{formatCurrency(amount as number)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transactions Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Payment Transactions</h2>
            <p className="mt-0.5 text-xs text-slate-500">{count} records · {activeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              disabled={transactions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
              title="Download CSV for current filtered table"
            >
              <FileDown className="h-4 w-4" />
              Download CSV ({activeLabel})
            </button>
            <button
              onClick={() => handleDownloadDirectReport("today")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
              title="Quick download today's payments CSV"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              Today CSV
            </button>
            <button
              onClick={() => handleDownloadDirectReport("total")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
              title="Quick download all-time total payments CSV"
            >
              <Download className="h-3.5 w-3.5 text-indigo-600" />
              Total CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
            <Receipt className="h-12 w-12 stroke-[1.5] text-slate-300" />
            <p className="text-sm font-bold text-slate-500">No payments found for this period.</p>
            <p className="text-xs text-slate-400">Try selecting a different date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 uppercase tracking-wider font-extrabold">
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6">Customer / Project</th>
                  <th className="py-3.5 px-6">Payment Mode</th>
                  <th className="py-3.5 px-6">Ref. / Note</th>
                  <th className="py-3.5 px-6 text-right">Amount</th>
                  <th className="py-3.5 px-6 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="group hover:bg-slate-50/80 transition">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <p className="font-bold text-slate-800">{formatDate(txn.paymentDate)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{txn.source?.toLowerCase() ?? "project"}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{txn.project?.projectName ?? "—"}</p>
                          {txn.project?.customer?.fullName && (
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {txn.project.customer.fullName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${METHOD_COLORS[txn.paymentMethod] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {txn.paymentMethod}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {txn.transactionId && (
                        <p className="font-mono text-[11px] text-slate-500">{txn.transactionId}</p>
                      )}
                      {txn.note && (
                        <p className="text-[11px] text-slate-400 mt-0.5 italic">{txn.note}</p>
                      )}
                      {!txn.transactionId && !txn.note && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <p className="text-sm font-black text-emerald-700">Rs. {Number(txn.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleGenerateReceipt(txn.id, txn.amount)}
                        disabled={receiptLoading === txn.id}
                        title="Generate Receipt PDF"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                      >
                        {receiptLoading === txn.id
                          ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                          : <Receipt className="h-3 w-3" />}
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={4} className="py-4 px-6 text-xs font-bold text-slate-600 uppercase tracking-wider">Total</td>
                  <td className="py-4 px-6 text-right text-sm font-black text-slate-900">{formatCurrency(totalAmount)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* PDF Viewer */}
      {pdfViewer && (
        <PdfViewerModal
          url={pdfViewer.url}
          title={pdfViewer.title}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  );
}
