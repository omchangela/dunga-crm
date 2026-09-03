"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserPlus, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

export default function SeedLeadsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [error, setError]     = useState("");

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

  async function handleSeed() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${backendUrl}/seed_leads`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Failed to seed leads.");
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Failed to connect to backend seed leads endpoint.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-trigger on page load
  useEffect(() => {
    handleSeed();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl space-y-6">
        
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Bulk Leads Importer</h1>
            <p className="text-xs font-semibold text-slate-400">Import 8,205 Lead Numbers into Database</p>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            <p className="text-xs font-bold text-slate-300">Importing 8,205 unique lead numbers into database...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Import Operation Failed</span>
            </div>
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{result.message || "Leads Imported Successfully!"}</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Leads Imported:</span>
                <span className="text-emerald-300 font-bold">{result.importedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Total Extracted:</span>
                <span className="text-emerald-300 font-bold">{result.totalInFile}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={handleSeed}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Re-run Import
          </button>

          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            View Leads Table
          </Link>
        </div>

      </div>
    </div>
  );
}
