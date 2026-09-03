"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trash2, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";

export default function ResetDatabasePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [error, setError]     = useState("");

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

  async function handleReset() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${backendUrl}/reset_db`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Failed to reset database.");
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Failed to connect to backend reset endpoint.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-trigger on page load if requested
  useEffect(() => {
    handleReset();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl space-y-6">
        
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Database Reset Control</h1>
            <p className="text-xs font-semibold text-slate-400">Public Database Wipe & Admin Initialization Endpoint</p>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            <p className="text-xs font-bold text-slate-300">Wiping database tables and seeding fresh Admin user...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Reset Operation Failed</span>
            </div>
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{result.message || "Database Reset Successfully!"}</span>
            </div>

            {result.admin && (
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-1.5 text-xs font-mono">
                <p className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-1 font-sans">Default Admin Credentials</p>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Email:</span>
                  <span className="text-emerald-300 font-bold">{result.admin.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Password:</span>
                  <span className="text-emerald-300 font-bold">{result.admin.password}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={handleReset}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-rose-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Re-run DB Reset
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
