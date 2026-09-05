"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, TrendingUp, Building2, Bell, Clock, ArrowRight, Target, CheckCircle2 } from "lucide-react";
import { employeePortalApi } from "@/lib/api";
import { useEmployeeAuth } from "@/contexts/EmployeeAuthContext";

function formatINR(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

function targetColor(percent: number) {
  if (percent >= 100) return { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (percent >= 75)  return { bar: "bg-blue-500",  text: "text-blue-700",  bg: "bg-blue-50 border-blue-200"  };
  if (percent >= 50)  return { bar: "bg-yellow-500",text: "text-yellow-700",bg: "bg-yellow-50 border-yellow-200"};
  return              { bar: "bg-red-500",   text: "text-red-700",   bg: "bg-red-50 border-red-200"   };
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#e5e9f2] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f6ff]">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold text-[#1a2035]">{value}</p>
      <p className="text-sm font-medium text-[#8094ae]">{label}</p>
      {sub && <p className="text-xs text-[#8094ae]">{sub}</p>}
    </div>
  );
}

export default function EmployeeDashboardPage() {
  const { employee } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [doneToast, setDoneToast] = useState<string | null>(null);
  const [doneBusy, setDoneBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    employeePortalApi.dashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkDone(reminderId: string) {
    setDoneBusy(reminderId);
    try {
      await employeePortalApi.markReminderDone(reminderId);
      setDoneToast("Reminder marked as done.");
      setTimeout(() => setDoneToast(null), 2500);
      load();
    } catch {
      // silent — dashboard is best-effort
    } finally { setDoneBusy(null); }
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0971fe] border-t-transparent" />
    </div>
  );

  const target   = data?.target ?? {};
  const leads    = data?.leads  ?? {};
  const tColor   = targetColor(target.percent ?? 0);
  const now      = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-6">

      {/* Done toast */}
      {doneToast && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{doneToast}
        </div>
      )}

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a2035]">{greeting}, {employee?.name?.split(" ")[0]} 👋</h1>
        <p className="mt-0.5 text-sm text-[#8094ae]">{employee?.role} · {monthLabel}</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5 text-[#0971fe]" />}       label="My Leads"   value={leads.total    ?? 0} />
        <StatCard icon={<Clock className="h-5 w-5 text-yellow-500" />}      label="Pending"    value={leads.pending  ?? 0} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-green-500" />}  label="Converted"  value={leads.converted?? 0} />
        <StatCard icon={<Building2 className="h-5 w-5 text-purple-500" />}  label="Customers"  value={data?.customers ?? 0} />
      </div>

      {/* Target card */}
      {target.target > 0 && (
        <div className={`rounded-xl border p-5 ${tColor.bg}`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className={`h-5 w-5 ${tColor.text}`} />
              <span className={`text-sm font-bold ${tColor.text}`}>{monthLabel} Target</span>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tColor.bg} ${tColor.text} border`}>
              {target.percent ?? 0}%
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            <div>
              <p className="text-xs text-[#8094ae]">Target</p>
              <p className={`text-lg font-bold ${tColor.text}`}>{formatINR(target.target)}</p>
            </div>
            <div>
              <p className="text-xs text-[#8094ae]">Achieved</p>
              <p className={`text-lg font-bold ${tColor.text}`}>{formatINR(target.achieved)}</p>
            </div>
            <div>
              <p className="text-xs text-[#8094ae]">Remaining</p>
              <p className={`text-lg font-bold ${tColor.text}`}>{formatINR(target.remaining)}</p>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/60">
            <div className={`h-2.5 rounded-full transition-all duration-500 ${tColor.bar}`}
              style={{ width: `${Math.min(target.percent ?? 0, 100)}%` }} />
          </div>
          {(target.percent ?? 0) >= 100 && (
            <p className="mt-2 text-xs font-bold text-green-700">🎉 Target achieved!</p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Upcoming reminders */}
        <div className="rounded-xl border border-[#e5e9f2] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#0971fe]" />
              <span className="text-sm font-semibold text-[#1a2035]">Upcoming Reminders</span>
            </div>
            <Link href="/employee/leads" className="flex items-center gap-1 text-xs text-[#0971fe] hover:underline">
              View leads <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#e5e9f2]">
            {(data?.upcomingReminders ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#8094ae]">No upcoming reminders.</p>
            ) : (data?.upcomingReminders ?? []).map((r: any) => (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1a2035]">{r.lead?.fullName}</p>
                    <p className="text-xs text-[#8094ae]">{r.lead?.phone}</p>
                    {r.note && <p className="mt-0.5 truncate text-xs text-gray-500">{r.note}</p>}
                    <p className="mt-0.5 text-xs text-[#8094ae]">{formatDateTime(r.reminderAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {r.lead?.id && (
                      <Link href={`/employee/leads/${r.lead.id}`}
                        className="rounded-md border border-[#e5e9f2] px-2 py-0.5 text-[11px] font-medium text-[#0971fe] hover:bg-[#f0f6ff]">
                        View Lead
                      </Link>
                    )}
                    <button onClick={() => handleMarkDone(r.id)} disabled={doneBusy === r.id}
                      className="flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-100 disabled:opacity-50">
                      <CheckCircle2 className="h-3 w-3" />Mark Done
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent follow-ups */}
        <div className="rounded-xl border border-[#e5e9f2] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#0971fe]" />
              <span className="text-sm font-semibold text-[#1a2035]">Recent Follow-Ups</span>
            </div>
          </div>
          <div className="divide-y divide-[#e5e9f2]">
            {(data?.recentFollowUps ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#8094ae]">No follow-ups logged yet.</p>
            ) : (data?.recentFollowUps ?? []).map((f: any) => (
              <div key={f.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1a2035]">{f.lead?.fullName}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{f.note}</p>
                  </div>
                  <p className="shrink-0 text-xs text-[#8094ae]">{formatDateTime(f.followedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
