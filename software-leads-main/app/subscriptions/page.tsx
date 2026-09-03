"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe, Server, Shield, Wrench, Package, CreditCard, ArrowRight } from "lucide-react";
import { fetchSubscriptions } from "@/lib/api";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import type { Subscription } from "@/lib/store";

type Category = Subscription["category"];

const CATEGORIES: {
  key: Category; label: string; slug: string; icon: React.ElementType;
  color: string; bg: string; border: string; barColor: string; desc: string;
}[] = [
  { key: "Domain",                slug: "domain",       label: "Domain Names",          icon: Globe,   color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   border: "border-blue-200/80 dark:border-blue-800/40",   barColor: "bg-blue-600",   desc: "Domain registrations & automatic renewal schedules"    },
  { key: "Hosting",               slug: "hosting",      label: "Web Hosting",           icon: Server,  color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200/80 dark:border-purple-800/40", barColor: "bg-purple-600", desc: "Web hosting servers, VPS, and cloud infrastructure"         },
  { key: "SSL",                   slug: "ssl",          label: "SSL Certificates",      icon: Shield,  color: "text-emerald-600 dark:text-emerald-400",  bg: "bg-emerald-50 dark:bg-emerald-950/40",  border: "border-emerald-200/80 dark:border-emerald-800/40",  barColor: "bg-emerald-600",  desc: "SSL security certificates & encryption renewals"       },
  { key: "Maintenance",           slug: "maintenance",  label: "Maintenance SLA",       icon: Wrench,  color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200/80 dark:border-amber-800/40", barColor: "bg-amber-600", desc: "Website maintenance, SLA retainers, & technical support" },
  { key: "Software Subscription", slug: "software",     label: "Software Licenses",     icon: Package, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200/80 dark:border-indigo-800/40", barColor: "bg-indigo-600", desc: "SaaS software tools & third-party software licenses"     },
];

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions().then(setSubs).catch(() => setSubs([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-blue-200 mb-2">
              <CreditCard className="h-3.5 w-3.5 text-blue-300" />
              Infrastructure & SaaS Billings
              <span className="opacity-40">•</span>
              {subs.length} Active Subscriptions
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Subscriptions & Renewals
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Manage domain registrations, server hosting plans, SSL certificates, and client maintenance contracts.
            </p>
          </div>
        </div>
      </section>

      {/* ══ 5 CATEGORIES GRID ══ */}
      {loading ? (
        <CardGridSkeleton count={5} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(({ key, slug, label, icon: Icon, color, bg, border, barColor, desc }) => {
            const catSubs     = subs.filter((s) => s.category === key);
            const activeCount = catSubs.filter((s) => s.status === "Active").length;
            const expiredCount = catSubs.filter((s) => s.status === "Expired").length;
            const renewingSoon = catSubs.filter((s) => {
              if (s.status !== "Active") return false;
              const days = (new Date(s.renewalDate).getTime() - Date.now()) / 86400000;
              return days >= 0 && days <= 30;
            }).length;

            return (
              <button
                key={key}
                onClick={() => router.push(`/subscriptions/${slug}`)}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-left shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className={`h-1.5 w-full ${barColor}`} />

                <div className="flex flex-col gap-5 p-6">
                  <div className="flex items-center gap-3.5">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${bg} ${border}`}>
                      <Icon className={`h-6 w-6 ${color}`} />
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors flex items-center gap-1">
                        {label}
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1" />
                      </p>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">{desc}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    <div className={`rounded-2xl border px-3 py-2.5 ${bg} ${border}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
                      <p className={`mt-0.5 text-xl font-extrabold ${color}`}>{catSubs.length}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/40 dark:border-emerald-800">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active</p>
                      <p className="mt-0.5 text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{activeCount}</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2.5 ${expiredCount > 0 ? "border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800"}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${expiredCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>Expired</p>
                      <p className={`mt-0.5 text-xl font-extrabold ${expiredCount > 0 ? "text-rose-700 dark:text-rose-300" : "text-slate-400"}`}>{expiredCount}</p>
                    </div>
                  </div>

                  {renewingSoon > 0 && (
                    <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2 dark:bg-amber-950/40 dark:border-amber-800">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-extrabold text-white">{renewingSoon}</span>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Renewing within 30 days</p>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
